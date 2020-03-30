// The fake routes for faster frontend development
var express = require('express');
var router = express.Router();

router.get('/edit', (req, res) => {
    res.render('edit', {
      title: "Create New Link",
      linkname: 'exp',
      oldDest: 'http://old.example.com',
      author: "johnsmith@example.com",
      editable: true
    });
});

router.get('/newedit', (req, res) => {
    res.render('link-detail', {
      msgType: 'success',
      msg: "Your link is created successfully!",
      title: 'Edit',
      linkname: 'fake_qr',
      addLogo: true,
      caption: 'Hello World!',
      oldDest: 'http://old.example.com',
      author: "johnsmith@example.com",
      editable: true
    });
});


module.exports = router;
