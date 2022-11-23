const express = require('express');
const router = express.Router();

router.get('/', (req,res) =>{
    res.send(`
    <h1>Home</h1>
    <p>
        <a href="/private">Private</a></p>
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
