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

app.get(/\/[A-Za-z0-9_]/, function(req, res) {
  console.log(`try to direct to`, req.path, ' ...');
  let golink = process.env['LINK_' + req.path.slice(1)];
  console.log(process.env);
  if (golink) {
    console.log('redirect to golink:', golink);
    res.redirect(golink);
  } else {
    console.log('Not found', 'LINK_' + req.path.slice(1));
    res.status(404).send("No link for " + req.path);
  }

});

var PORT = process.env.PORT || 3000;
console.log('Start listening on ', PORT);
app.listen(PORT);

