var express = require('express');
var router = express.Router();
var Auth0Strategy = require('passport-auth0'),
    passport = require('passport');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn();
import * as mysql from "mysql";

let connection;

const asyncHandler = fn => (req, res, next) =>
    Promise
        .resolve(fn(req, res, next))
        .catch(next)

if (process.env.CLEARDB_DATABASE_URL) {
  console.log(`Using MySQL`);
  connection = mysql.createConnection(process.env.CLEARDB_DATABASE_URL);
  let handleDisconnect = () => {
    connection.on('error', function(err){
      console.log('Handling mysql err', err);
      if(!err.fatal)
      {
        return;
      }
      if(err.code !== 'PROTOCOL_CONNECTION_LOST')
      {
        throw err;
      }
      console.log('\nRe-connecting lost connection: ' +err.stack);

      connection = mysql.createConnection(process.env.CLEARDB_DATABASE_URL);
      connection.connect();
      handleDisconnect();
    });
  };

  handleDisconnect();

  // connection.connect();


} else {
  console.log(`No MySQL specified, please set export CLEARDB_DATABASE_URL=<mysql url>`);
  process.exit(1);
}


function upsertLinkAsync(linkname, dest, cb) {
  let query = `
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
  let query = `SELECT linkname, dest, author from golinks WHERE linkname='${linkname}';`;

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

let getLinksByEmailAsync = async function(emails) {
  let emailsWhereClause = emails.map(v=>`'${v}'`).join(',');
  let query = `SELECT linkname, dest, author from golinks WHERE author in (${emailsWhereClause});`;
  return new Promise(function(resolve, reject) {
    connection.query(query, (err, rows, fields) => {
      if (err) throw err;
      console.log('Result ', rows);
      if (rows.length > 0) {
        resolve(rows);
      } else {
        resolve(null);
      }
    });
  });
};

/* GET user profile. */
router.get('/user', ensureLoggedIn, asyncHandler(async function(req, res) {
  console.log(`111 Links!!!`, "End ofLINKs");
  let links = await getLinksByEmailAsync(req.user.emails.map(item => item.value));
  console.log(`222 Links!!!`, links, "End ofLINKs");
  res.render('user', {
    user: req.user,
    links: links
  });
  return;
}));

router.get('/edit', (req, res) => {
  res.render('edit', {
    title: "Create New Link", linkname: '', old_dest: '',
    author: req.user ? req.user.emails[0].value : "anonymous"
  });
});

router.post('/edit', function (req, res) {
  console.log(`Posting`, req);
  let linkname = req.body.linkname;
  let dest = req.body.dest;

  upsertLinkAsync(linkname, dest, function (rows) {
    console.log(`Done`);
    req.visitor.event("Edit", "Submit", "OK", {p: linkname}).send();
    res.send('OK');
  });
});

router.get('/edit/:linkname([A-Za-z0-9-_]+)', function (req, res) {
  console.log(`Editing`);
  let linkname = req.params.linkname;
  getLinkAsync(linkname, function (dest) {
    console.log('Edit golink:', linkname, dest);
    res.render('edit', {
      title: `Edit Existing Link`, linkname: linkname, old_dest: dest,
      author: req.user ? req.user.emails[0].value : "anonymous"
    });
    req.visitor.event("Edit", "Render", "", {p: linkname}).send();
  });
});

router.get('/:linkname([A-Za-z0-9-_]+)', function (req, res) {
  if (req.visitor) {
    console.log(`Set req.visitor`, req.visitor);
    req.visitor.pageview(req.originalPath).send();
  }
  let linkname = req.params.linkname;
  getLinkAsync(linkname, function (dest) {
    if (dest) {
      console.log('redirect to golink:', dest);
      res.redirect(dest);
      req.visitor.event("Redirect", "Hit", "Forward", {p: req.originalPath}).send();
    } else {
      console.log('Not found', 'LINK_' + req.params.linkname);

      res.render('edit', {
        title: "Create New Link",
        linkname: linkname,
        old_dest: dest,
        author: req.user ? req.user.emails[0].value : "anonymous"
      });
      req.visitor.event("Redirect", "Miss", "ToEdit", {p: req.originalPath}).send();
    }
  });
});

module.exports = router;