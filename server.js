const dotenv = require("dotenv");
dotenv.config();
const { MongoClient} = require("mongodb");
const express = require('express');
const { router } = require("express");
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
let client;


const publicRouter = require('./routes/public');
const privateRouter = require('./routes/private');
const aboutRouter = require('./routes/about');
const databaseRouter = require('./routes/database');

console.log(process.env.WEATHER_API_KEY);

app.use('/', publicRouter);
app.use('/private', privateRouter);
app.use('/about', aboutRouter);
app.use('/database', databaseRouter);



app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit:9}))
app.use(cors({
    origin: '*'
}));
app.use(function(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});


/* GET home page. */
app.get('./', function(req, res, next) {
    res.render('server', { title: 'Express' });
  });

app.use((req, res, next) => {
    console.log('Time: ', Date.now())
    next()
});

const colls = [
    { id: 0, name: 'courses' },
    { id: 1, name: 'students' },
    { id: 2, name: 'teachers' },
    { id: 3, name: 'projects' },
    { id: 4, name: 'project_lists' }
];

/*Constructor used to store id values for inserts. Its necessary because in order to insert a value, we have to go into the 
collection and find the maximum existing id so that we can set the next id for the new record to be inserted*/
class PreviousId {
    constructor(value, next) {
        this.value = value || null;
        this.next = next || null;
    }
};
//Current instance for setting new id for a new record
PreviousId.current = new PreviousId();

app.post('/api/createnewproject/:id', (req, res) => {
    var o = req.body;
    var dbo = client.db("db");
    var idValue = req.params.id;
    let searchCollection = colls[idValue].name;
    dbo.collection(searchCollection).find({}).sort({id:-1}).limit(1).toArray(function(err, res2) {
        if(err) throw err;
        let obj = res2[0];
        if((Object.getOwnPropertyNames(obj))[1] === 'id') {
            PreviousId.current.value = obj.id;
            PreviousId.current.next = obj.id += 1;
        }
        o.id = PreviousId.current.next;
        dbo.collection(searchCollection).insertOne(o, function(err, res3) {
            if(err) throw err;
            console.log('inserted, hopefully');    
        })
    })
})

app.post('/api/createnewuser/:id', (req, res) => {
    /*the stringified object passed from database service -- id, name, username, password and user_type*/
    var o = req.body;
    /*the individual stringified object values sent from database service*/
    //console.log(`user_type: ${obj.user_type} | username: ${obj.username}| password: ${obj.password}| name: ${obj.name}`);
    var dbo = client.db("db");
    /*id variable passed at end of url*/
    var idValue = req.params.id;
    //console.log(`idValue: ${idValue}`);
    /*collections object derived from the constant in this document, using the id variable as the index to 
    select the correct collection to get the greatest id value in the collection*/
    let searchCollection = colls[idValue].name;
    //console.log(`searchCollection: ${searchCollection}`);
    dbo.collection(searchCollection).find({}).sort({id:-1}).limit(1).toArray(function(err, res2) {
        if(err) throw err;
        let obj = res2[0];
        //validate that the database records do contain our custom id field
        if((Object.getOwnPropertyNames(obj))[1] === 'id') {
            //console.log(`typeof obj.id: ${typeof obj.id}`);
            //store previous max id within specified collection in PreviousId Object property to retain value
            PreviousId.current.value = obj.id;
            //set the next id to keep ids unique
            PreviousId.current.next = obj.id += 1;
        }
        //update value of id to increment by 1 from the largest id found in the database
        o.id = PreviousId.current.next;
        //remove object property "user_type" as it is no longer needed
        delete o.user_type;
        for(var p in o) {
            console.log(`${p} : ${o[p]}`);
        }
        //insert the new user in the database
        dbo.collection(searchCollection).insertOne(o, function(err, res3) {
            if(err) throw err;
            console.log('inserted, hopefully');    
        })
    })
})

app.get('/api/login/:login', (req, res) => {
    console.log(`req.params.login: ${req.params.login}`)    
    let v = req.params.login.split('|');
    let keys = [];
    let vals = [];
    for(let i = 1;i<v.length;i++) {        
        let current = v[i].split(':');
        keys.push(current[0]);
        vals.push(current[1]);
    }
    var dbo = client.db("db");    
    const nameVal = vals[0];
    const passVal = vals[1];
    //check whether student login credentials exist and are correct
    dbo.collection("students").find({username:nameVal, password:passVal}).toArray(function(err, res2) {
    let loginStatus = 0;
    let loginObj = {};
        if (err) throw err;
        try{
            if(`${JSON.stringify(res2[0].name).length}` > 0 ) {
                let name = res2[0].name;
                let id = res2[0].id;
                res.json({wasfound:true, name:name, id:id, user_type:'student'});
            } 
        } catch(e) {
            //check whether teacher login credentials exist and are correct
            dbo.collection("teachers").find({username:nameVal, password:passVal}).toArray(function(err, res3) {
                if(err) throw err;                
                try{
                    if(`${JSON.stringify(res3[0].name).length}` > 0 ) {
                        let name = res3[0].name;
                        let id = res3[0].id;  
                        res.json({wasfound:true, name:name, id:id, user_type:'student'});
                    }
                } catch(e) {
                    loginResponse = `|${String(loginStatus)}`
                    console.log(`2nd catch : req.params.login: ${req.params.login}`)
                } finally {
                    //check if student username was found but password was incorrect
                    dbo.collection("students").find({username:nameVal}).toArray(function(err, res4) {
                        if(err) throw err;
                        try{                            
                            if(`${JSON.stringify(res4[0].name).length}` > 0 ) {
                                let name = res4[0].name;
                                let id = res4[0].id;
                                //res.json({found:true, id:id, flag:'badpassword'});
                                console.log(`Student ${nameVal} attempted to login with an incorrect password`);
                            }
                        }
                        catch(e) {
                            //check if teacher username was found but password was incorrect------
                            dbo.collection("teachers").find({username:nameVal}).toArray(function(err, res5) {
                            if(err) throw err;                                                        
                            if(`${JSON.stringify(res5[0].name).length}` > 0 ) {
                                let name = res5[0].name;
                                let id = res5[0].id;                                
                                //res.json({found:true, id:id, flag:'badpassword'});
                                console.log(`Teacher ${res5[0].name} attempted to login with an incorrect password`);
                            }
                        })
                        //Last possible outcome, username was
                    } finally {
                        let name = '';
                        let id = '';
                        res.json({wasfound:false, name:name, id:id, user_type:''});
                    }
                });
                }
            })
        }
    })
})

//------------------------_-------------------------_-------------------------_-------------------------_-------------------------_-
app.post('/api/updateMany', (req, res) => {
    var obj = req.body;
    var dbo = client.db("ISIT422-db");
    dbo.collection("courses").insertOne(obj, function(err, res2) {
        if(err) {
            console.log(err);
            res.send(JSON.stringify(err));
        } else {
            res.send("inserted")
        }
    })
})

app.post('/api/findAndModify', (req, res) => {
    var obj = req.body;
    var dbo = client.db("ISIT422-db");
    dbo.collection("courses").insertOne(obj, function(err, res2) {
        if(err) {
            console.log(err);
            res.send(JSON.stringify(err));
        } else {
            res.send("inserted")
        }
    })
})


app.post('/api/insert', (req, res) => {
    var obj = req.body;
    var dbo = client.db("TestDB");
    dbo.collection("testC").insertOne(obj, function(err, res2) {
        if(err) {
            console.log(err);
            res.send(JSON.stringify(err));
        } else {
            res.send("inserted")
        }
    })
})

app.get('/api/courses', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.collection("courses").find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    })
})

app.get('/api/display', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.collection("students").find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    })
})

app.get('/api/display/:id', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.collection(colls[req.params.id].name).find({}).sort({id:-1}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;        
        res.send(res2);
    })
})


app.get('/api/collections', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.listCollections().toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    })
})

app.get('api/display1/:id', (req, res) => {
    dbo.collection("testC").findOne({}, function(err, res2) {
        if (err) throw err;
        res.send(res2);

    })
})

//Dummy Fetch Data for Lists
//Dummy Fetching Tests
app.get('/api/projectlistsnames', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.collection("project_lists").find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    })
})

app.get('/api/projects', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.collection("projects").find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    })
})

app.get('/api/findAndModify/:id', (req, res) => {
    var obj = req.body;        
    var dbo = client.db("db");    
    dbo.collection(colls[req.params.id].name).find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    })
})

app.get('/api/findAndModify/:id/:test', (req, res) => {
    var obj = req.body;
    let v = req.params.test.split('|');
    let keys = [];
    let vals = [];    
    for(let p in v) {
        let current = v[p].split(':');
        keys.push(current[0]);
        vals.push(current[1]);
    }

    var d = new Object;
    d.current = {};
    for(var i=2;i<keys.length;i++) {
        if(String(keys[i]).substr(-2) !== 'ds') {       
            d.current[[`${keys[i]}`]] = vals[i];
        }
    }    
    var dbo = client.db("db");    
    dbo.collection(colls[req.params.id].name).find({id:Number(vals[2])}).sort({id:1}).toArray(function(err, res2) {        
        if (err) throw err;
        let collection = dbo.collection(colls[req.params.id].name);
        let filter = {id:Number(vals[2])};
        let updateDocument = {
            $set: {id:Number(vals[2]), name:vals[3], username:vals[4], password:vals[5]},
        };
        let options = { upsert: true };
        collection.updateMany(filter, updateDocument, options, function(err, res3) {
            if(err) throw err;
            console.log('1 document updated');            
        })
    });
});

app.get('/api/delete/:id/:test', (req, res) => {
    var obj = req.body;
    let v = req.params.test.split('|');
    let keys = [];
    let vals = [];    
    for(let p in v) {
        let current = v[p].split(':');
        keys.push(current[0]);
        vals.push(current[1]);
    }

    var d = new Object;
    d.current = {};
    for(var i=2;i<keys.length;i++) {
        if(String(keys[i]).substr(-2) !== 'ds') {       
            d.current[[`${keys[i]}`]] = vals[i];
        }
    }    
    var dbo = client.db("db");    
    dbo.collection(colls[req.params.id].name).find({id:Number(vals[2])}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        let collection = dbo.collection(colls[req.params.id].name);
        let filter = {id:Number(vals[1])};
        collection.deleteOne(filter, function(err, res3) {
            if(err) throw err;
            //console.log('1 document deleted');
        })
    });
});

function makeConnection() {
    const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@isit422-groupproject-20.sdxooup.mongodb.net/${process.env.DEFAULT_DB}`;
    client = new MongoClient(uri);
    client.connect().then((con) => {
        console.log("mongodb connected");        
    })
}
var server = app.listen(5000, function() {
    console.log("listening on port ", server.address().port);
    makeConnection();
})
