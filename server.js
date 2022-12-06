const { MongoClient } = require("mongodb");
const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const bodyParser = require("body-parser");
//const cors = require("cors");
let client;

app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({
    extended: true, limit: "50mb", parameterLimit:9
    })
);
/*
app.use(cors({
    origin: "*"
}));
*/

app.use(function(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});

const colls = [
    { id: 0, name: "courses" },
    { id: 1, name: "students" },
    { id: 2, name: "teachers" },
    { id: 3, name: "projects" },
    { id: 4, name: "project_lists" }
];

/*Ensures each new insert is unique and increments 1 from the previous max*/
class PreviousId {
    constructor(value, next) {
        this.value = value || null;
        this.next = next || null;
    }
}
//Current instance for setting new id for a new record
PreviousId.current = new PreviousId();

app.post("/api/delete", (req, res) => {
    var o = req.body;
    var dbo = client.db("db");
    collection = (o.origin === 'teacher-landing' ? 'project_lists' : 'projects');
    let searchCollection = dbo.collection(collection);
    let filter = {id:o.id};
    searchCollection.deleteOne(filter, function(err, res2) {
        if(err) throw err;
    });
});


app.post('/api/createnewproject', (req, res) => {
    var o = req.body;
    var dbo = client.db("db");
    dbo.collection("projects").find({}).sort({id:-1}).limit(1).toArray(function(err, res2) {
        if(err) throw err;
        let obj = res2[0];
        console.log(`obj: ${obj}`);
        if((Object.getOwnPropertyNames(obj))[1] === 'id') {
            PreviousId.current.value = obj.id;
            PreviousId.current.next = obj.id += 1;
        }
        o.id = PreviousId.current.next;
        dbo.collection("projects").insertOne(o, function(err, res3) {
            if(err) throw err;
            console.log('inserted, hopefully');
        });
    });
});


app.post('/api/createnewcourse', (req, res) => {
    var o = req.body;
    var dbo = client.db("db");
    dbo.collection("courses").find({}).sort({id:-1}).limit(1).toArray(function(err, res2) {
        if(err) throw err;
        let obj = res2[0];
        if((Object.getOwnPropertyNames(obj))[1] === 'id') {
            PreviousId.current.value = obj.id;
            PreviousId.current.next = obj.id += 1;
        }
        o.id = PreviousId.current.next;
        dbo.collection("courses").insertOne(o, function(err, res3) {
            if(err) throw err;
            console.log('inserted, hopefully');
        });
    });
});

app.post('/api/createnewuser/:id', (req, res) => {
    /*the stringified object passed from database service -- id, name, username, password and user_type*/
    var o = req.body;
    /*the individual stringified object values sent from database service*/
    //console.log(`user_type: ${obj.user_type} | username: ${obj.username}| password: ${obj.password}| name: ${obj.name}`);
    var dbo = client.db("db");
    /*id variable passed at end of url-- this is for selecting the user type by means of the index for the collections
    , not for the id that gets inserted with the new user. The user's id will be generated. It is to differentiate between students and teachers*/
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
        });
    });
});

app.get('/api/login/:login', (req, res, next) => { 
    let v = req.params.login.split('|');
    let keys = [];
    let vals = [];
    //assign the "login" url parameters to key value pairs
    for(let i = 1;i<v.length;i++) {        
        let current = v[i].split(':');
        keys.push(current[0]);
        vals.push(current[1]);
    }
    var dbo = client.db("db");
    //name to look up in the database
    const nameVal = vals[0];
    //password to look up in the database
    const passVal = vals[1];
    //first pass, check to see if the name and password are found in the students collection and are correct
    dbo.collection("students").find({username:nameVal, password:passVal}).toArray(function(err, res2) {
        try {
            if (err) throw err;
            `${JSON.stringify(res2[0].name).length}` > 0 ? res.json({wasfound:true, name:res2[0].name, id:res2[0].id, user_type:'student'}) : next();
                return;            
        } catch(e) {}
    });
    //Second pass, if they weren't found in the students collection, check to see if the name and password are found in the teachers collection and are correct
    dbo.collection("teachers").find({username:nameVal, password:passVal}).toArray(function(err, res3) {        
        try {    
            if(err) throw err;
            `${JSON.stringify(res3[0].name).length}` > 0 ? res.json({wasfound:true, name:res3[0].name, id:res3[0].id, user_type:'teacher'}) : next();
                return;
        } catch(e) {}
    });
    //Check to see if the username was found in the students collection but the password was incorrect
    dbo.collection("students").find({username:nameVal}).toArray(function(err, res4) {                
        if(err) throw err;                
        try {                
            `${JSON.stringify(res4[0].name).length}` > 0 ? res.json({wasfound:true, name:res4[0].name, id:res4[0].id, user_type:'student', passFail:true}) : next();
        } catch(e) {}
    });
    //Check to see if the username was found in the teachers collection but the password was incorrect
    dbo.collection("teachers").find({username:nameVal}).toArray(function(err, res5) {
        if(err) throw err;
        try {
            `${JSON.stringify(res5[0].name).length}` > 0 ? res.json({wasfound:true, name:res5[0].name, id:res5[0].id, user_type:'teacher', passFail:true}) : next();
        } catch(e) {}
    });
});

app.post('/api/editproject', (req, res) => {
    var dbo = client.db("db");
    let collection = dbo.collection('projects');
    let o = req.body;
    let objArr = [];
    //This array holds the values that are not available to the user to be edited but need to be reinserted with the edited values
    let reInsertProps = [];    
    let NumId = Number(o.id);
    collection.find({id:NumId}).sort({id:-1}).limit(3).toArray(function(err, res2) {
        if(err) throw err;
        for(let p in res2[0]) {
            console.log(`
                p:${p}
                res2[0][p]: ${res2[0][p]}
            `);
            if((p === 'id') || (p === 'name') || (p === 'description')) {
                objArr.push(res2[0][p]);
            } else if ((p === 'project_list_id') || (p === 'student_ids')) {
                reInsertProps.push(res2[0][p]);
            }
        };
        let filter = {id:`${Number(objArr[0])}`};
        //build the update object with the required properties that must match the the fields in the projects collection
        let updateObject = {
            id:`${Number(objArr[0])}`,
            name:`${o.name}`,
            description:`${o.description}`,
            project_list_id:`${reInsertProps[0]}`,
            student_ids:[ `${reInsertProps[1]}` ]
            //student_ids:`${reInsertProps[1]}` 
        };
        //set up the update database call object
        let updateDocument = { $set: updateObject };
        //It should only get here assuming the record was found so set upsert to false to ensure we're only editing an existing item
        let options = { upsert: false };
        //make the update to the database

        collection.updateMany(filter, updateDocument, options, function(err, res3) {
            if(err) throw err;
            let modCount = res3.modifiedCount;let matched = res3.matchedCount; let acknowledged = res3.acknowledged;
            let result = modCount
            console.log(`
                modCount: ${modCount}
                matched: ${matched}
                acknowledged: ${acknowledged}
            `)
            //Error handling using the default return mongo object properties            
            let msg = '';
            /*switch (result) {
                case ((modCount > 0) && (res3.modifiedCount < 2)):
                    msg = `Document has been modified - modified count: 1`;
                    break;
                case ((upCount > 0)):
                    console.log('Document upserted, not updated - upserted count: >0');
                    break;
                case (res3.modifiedCount > 1):
                    console.log('Error updating the document - modified count: >1');
                    break;
                default:
                    console.log(`
                    came to default:
                    ${res3.modifiedCount}
                    `);
                };*/
            });
        });
    });

app.get('/api/getStudents', (req, res) => {
    var dbo = client.db("db");
    dbo.collection("students").find().toArray(function(err, findRes) {
        res.json(findRes);
    });
});

app.get('/api/getCoursesByTeacher/:id', (req, res) => {
    var dbo = client.db("db");    
    let idNum = Number(req.params.id);    
    dbo.collection("courses").find({teacher_id:idNum}).toArray(function(err, res2) {
        if (err) throw err;
        let arrOfObjects = [];
        for(let i = 0;i < res2.length; i++){
            let o = {name:res2[i].name, id:String(res2[i].id)};
            arrOfObjects.push(o);
        }
        res.json(arrOfObjects);
    });
});

app.get('/api/getProject/:id', (req, res) => {
    var dbo = client.db("db");

    dbo.collection("projects").find({id:Number(req.params.id)}).toArray(function(err, res2) {
        if (err) throw err;
        let arrOfObjects = [];        
        for(let i = 0;i < res2.length; i++){
            let o = {name:res2[i].name, projectDescription:res2[i].description};
            arrOfObjects.push(o);
        }
        res.json(arrOfObjects);
    });
});

app.post('/api/newprojectlist', (req, res) => {
    var dbo = client.db("db");
    let o = req.body;    
    //this sorts the collection in descending order and limits it to the last entry i.e. the entry with the greatest id value.
    dbo.collection("project_lists").find({}).sort({id:-1}).limit(1).toArray(function(err, res2) {
        if(err) throw err;
        //reasign the object on which we are inserting
        let obj = res2[0];
        //validate that the database records do contain our custom id field
        //console.log(`Object.getOwnPropertyNames(obj)[1]: ${Object.getOwnPropertyNames(obj)[1]}`);
        if((Object.getOwnPropertyNames(obj))[1] === 'id') {
            //store previous max id within specified collection in PreviousId Object property to retain value
            PreviousId.current.value = obj.id;
            //set the next id to keep ids unique
            PreviousId.current.next = obj.id += 1;
        }
        //update value of id to increment by 1 from the largest id found in the database
        o.id = PreviousId.current.next;
        dbo.collection("project_lists").insertOne(o, function(err, res3) {
            if(err) throw err;
            console.log('Project list successfully inserted'); 
            res.json(o);   
        });
    });
});

function makeConnection() {
    const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@isit422-groupproject-20.sdxooup.mongodb.net/${process.env.DEFAULT_DB}`;
    //const uri = "mongodb+srv://eric:thirteen@isit422-groupproject-20.sdxooup.mongodb.net/testDB";
    client = new MongoClient(uri);
    client.connect().then((con) => {
        console.log("mongodb connected");        
    });
};

//------------------------_-------------------------_-------------------------_-------------------------_-------------------------_-
/********************Endpoints below are for the debugging/testing Database Component**********************************************/
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
    });
});

//This is for the debugging Database component
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
    });
});

//This is for the debugging Database component
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
    });
});

//This is for the debugging Database component
app.get('/api/courses', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.collection("courses").find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    });
});

//This is for the debugging Database component
app.get('/api/display', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.collection("students").find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    });
});

//This is for the debugging Database component
app.get('/api/display/:id', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.collection(colls[req.params.id].name).find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;        
        res.send(res2);
    });
});

//This is for the debugging Database component
app.get('api/display1/:id', (req, res) => {
    dbo.collection("testC").findOne({}, function(err, res2) {
        if (err) throw err;
        res.send(res2);
    });
});

//This is for the debugging Database component
app.get('/api/collections', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.listCollections().sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    });
});

//This is for the debugging Database component
app.get('/api/projectlistsnames', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.collection("project_lists").find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    });
});

//This is for the debugging Database component
app.get('/api/projects', (req, res) => {
    var obj = req.body;
    console.log(obj);
    var dbo = client.db("db");
    dbo.collection("projects").find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    });
});

//This is for the debugging Database component
app.get('/api/findAndModify/:id', (req, res) => {
    var obj = req.body;        
    var dbo = client.db("db");    
    dbo.collection(colls[req.params.id].name).find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    });
});

//This is for the debugging Database component
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

//This is for the debugging Database component
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

//This is for the debugging Database component
app.get('/api/findAndModify/:id', (req, res) => {
    var obj = req.body;        
    var dbo = client.db("db");    
    dbo.collection(colls[3].name).find({}).sort({id:1}).toArray(function(err, res2) {
        if (err) throw err;
        res.send(res2);
    });
});
//------------------------_-------------------------_-------------------------_-------------------------_-------------------------_-
/**************************************End debugging/testing Database Component****************************************************/
//------------------------_-------------------------_-------------------------_-------------------------_-------------------------_-


var server = app.listen(5000, function() {
    console.log("listening on port ", server.address().port);
    makeConnection();
});