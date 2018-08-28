var express = require('express');
var bodyParser = require('body-parser');
var http = require("http");


var app = express();
var bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'pug');

var server = http.createServer(app);
var connect;

if (process.env.OPEN_GOLINKS_GA_ID) {
    console.log(`Setting Google Analytics with Tracking Id = `, process.env.OPEN_GOLINKS_GA_ID);
  // Get the module
  var expressGoogleAnalytics = require('express-google-analytics');
  // Insert your Google Analytics Id, Shoule be something like 'UA-12345678-9'
  var analytics = expressGoogleAnalytics(process.env.OPEN_GOLINKS_GA_ID);

  //Add to express before your routes
  app.use(analytics);
}

var usingMySQL = false;
if (process.env.CLEARDB_DATABASE_URL) {
  usingMySQL = true;
  console.log(`Using MySQL`);
  var mysql = require('mysql');
  var connection = mysql.createConnection(process.env.CLEARDB_DATABASE_URL);
  connection.connect();
} else {
  console.log(`NOT Using MySQL`);
}

app.get('/:linkname([A-Za-z0-9-_]+)', function(req, res) {
  console.log(`try to direct to`, req.params.linkname, ' ...');
  let golink = process.env['LINK_' + req.params.linkname];
  if (golink) {
    console.log('redirect to golink:', golink);
    res.redirect(golink);
  } else {
    console.log('Not found', 'LINK_' + req.params.linkname);
    res.status(404).send("No link for " + req.path);
  }

});

if (usingMySQL) {

  function upsertLinkAsync(linkname, dest, cb) {
    var query = `
INSERT INTO golinks (linkname, dest, author)
VALUES ('${linkname}', '${dest}', 'system')
ON DUPLICATE KEY UPDATE
    dest = '${dest}',
    author = 'system';
    `;

    connection.query(query, function (err, rows, fields) {
      if (err) throw err;
      console.log('Result ', rows);
      cb(rows);
    })
  }
  function getLinkAsync(linkname, cb) {
    var query = `SELECT linkname, dest, author from golinks WHERE linkname='${linkname}';`;

    connection.query(query, function (err, rows, fields) {
      if (err) throw err;
      console.log('Result ', rows);
      if (rows.length > 0) {
        cb(rows[0].dest);
      } else {
        cb(null);
      }
    })
  }

  app.get('/edit/:linkname([A-Za-z0-9-_]+)', function(req, res) {
    console.log( `Editing`);
    var linkname = req.params.linkname;
    let golink = process.env['LINK_' + linkname];
    if (usingMySQL) getLinkAsync(linkname, function(dest) {
      console.log('Edit golink:', linkname, dest);
      res.render('edit', { linkname: linkname, old_dest:dest})
    });
  });

  app.post('/edit', function(req, res) {
    console.log( `Posting`, req);
    var linkname = req.body.linkname;
    var dest = req.body.dest;
    upsertLinkAsync(linkname, dest, function(rows) {
      console.log(`Done`);
      res.send('OK');
    });
  });
}

var PORT = process.env.PORT || 3000;
console.log('Start listening on ', PORT);
app.listen(PORT);

