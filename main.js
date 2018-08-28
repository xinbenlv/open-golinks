var express = require('express');
var jade = require('jade');
var http = require("http");

var app = express();
var server = http.createServer(app);

app.get('/example', function(req, res) {
    console.log('hit url');
	// Process the data received in req.body
    res.redirect('https://example.url');
    console.log('redirect');
});

console.log('start listening');
app.listen(3000);

