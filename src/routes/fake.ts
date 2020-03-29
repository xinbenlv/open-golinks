// The fake routes for faster frontend development
var express = require('express');
var router = express.Router();

router.get('/edit', (req, res) => {
    res.render('edit', {
      title: "Create New Link",
      linkname: 'exp',
      old_dest: 'http://old.example.com',
      author: "johnsmith@example.com",
      editable: true
    });
});

router.get('/newedit', (req, res) => {
    res.render('link-detail', {
      title: "Your link is created successfully!",
      linkname: 'exp',
      old_dest: 'http://old.example.com',
      author: "johnsmith@example.com",
      editable: true
    });
});


module.exports = router;
