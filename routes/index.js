var express = require('express');
var router = express.Router();
const backend = require('../server')

/* GET home page. */
router.get('../', function(req, res, next) {
  res.render('server', { title: 'Express' });
});

router.get('/about', (req, res) => {
  res.send('About our project')
})

router.use((req, res, next) => {
  console.log('Time: ', Date.now())
  next()
})






module.exports = router
