var express = require('express');
var jade = require('jade');
var http = require("http");

var app = express();
var server = http.createServer(app);




if (process.env.OPEN_GOLINKS_GA_ID) {
    console.log(`Setting Google Analytics with Tracking Id = `, process.env.OPEN_GOLINKS_GA_ID);
  // Get the module
  var expressGoogleAnalytics = require('express-google-analytics');
  // Insert your Google Analytics Id, Shoule be something like 'UA-12345678-9'
  var analytics = expressGoogleAnalytics(process.env.OPEN_GOLINKS_GA_ID);

  //Add to express before your routes
  app.use(analytics);
}


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

