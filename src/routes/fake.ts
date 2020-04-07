// The fake routes for faster frontend development
const express = require('express');
const fakeRouter = express.Router();

fakeRouter.get('/edit', (req, res) => {
  res.render('edit', {
    title: "Create New Link",
    golink: 'exp',
    oldDest: 'http://old.example.com',
    author: "johnsmith@example.com",
    editable: true
  });
});

fakeRouter.get('/newedit', (req, res) => {
  res.render('link-detail', {
    msgType: 'success',
    msg: "Your link is created successfully!",
    title: 'Edit',
    golink: 'fake_qr',
    addLogo: true,
    caption: 'Hello World!',
    oldDest: 'http://old.example.com',
    author: "johnsmith@example.com",
    editable: true
  });
});


export default fakeRouter;
