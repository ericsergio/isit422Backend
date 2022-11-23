const express = require('express');
const router = express.Router();

router.get('/', (req,res) =>{
    res.send(`
    <h1>Database View</h1>
    <p>
        <a href="/">Home</a>
    </p>
    <p>
        <a href="/about">About</a>
    </p>
    <p>
        <a href="/database">Database</a>
    </p>
    `
    );
    
});

module.exports = router;