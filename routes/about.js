const express = require('express');
const router = express.Router();

router.get('/', (req,res) =>{
    res.send(`
    <h1>About View</h1>
    <p>
        <a href="/private">Private</a>
    </p>
    <p>
        <a href="/">Home</a>
    </p>
    <p>
        <a href="/database">Database</a>
    </p>
    `);
    
});

module.exports = router;
