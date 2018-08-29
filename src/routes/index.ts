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
    connection.on('error', function (err) {
      console.log('Handling mysql err', err);
      if (!err.fatal) {
        return;
      }
      if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
        throw err;
      }
      console.log('\nRe-connecting lost connection: ' + err.stack);

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

let editable = function (author, user) {
  console.log(`Author: ${author}`, 'user', user);
  if (author === 'anonymous') return true;
  else if (user && user.emails.map(i => i.value).indexOf(author) >= 0) {
    return true;
  }
  return false;
};
let upsertLinkAsync = async function (linkname, dest, author) {
  let query = `
INSERT INTO golinks (linkname, dest, author)
VALUES ('${linkname}', '${dest}', '${author}')
ON DUPLICATE KEY UPDATE
    dest = '${dest}',
    author = '${author}';
    `;
  return new Promise((resolve, reject) => {
    connection.query(query, function (err, rows, fields) {
      if (err) reject(err);
      else resolve(rows);
    })
  });
};

let getLinkAsync = async function (linkname) {
  let query = `SELECT linkname, dest, author from golinks WHERE linkname='${linkname}';`;
  return new Promise((resolve, reject) => {
    connection.query(query, function (err, rows, fields) {
      if (err) reject(err);
      else resolve(rows);
    })
  });
};

let getLinksByEmailAsync = async function (emails) {
  let emailsWhereClause = emails.map(v => `'${v}'`).join(',');
  let query = `SELECT linkname, dest, author from golinks WHERE author in (${emailsWhereClause});`;
  return new Promise(function (resolve, reject) {
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
router.get('/user', ensureLoggedIn, asyncHandler(async function (req, res) {
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

router.post('/edit', asyncHandler(async function (req, res) {
  console.log(`Posting`, req);
  let linkname = req.body.linkname;
  let dest = req.body.dest;
  // Check if links can be updated. // also need to worry about trace
  let links = await getLinkAsync(linkname) as Array<any>;
  if (links.length && links[0].author != "anonymous" && req.user && req.user.emails.map(i => i.value).indexOf(links[0].author) < 0) {
    res.status(403).send(`You don't have permission to edit ${linkname} which belongs to ${links[0].author}.`);
  } else {
    await upsertLinkAsync(linkname, dest, req.user ? req.user.emails[0].value : 'anonymous');
    console.log(`Done`);
    req.visitor.event("Edit", "Submit", "OK", {p: linkname}).send();
    res.send('OK');
  }

}));

router.get('/edit/:linkname([A-Za-z0-9-_]+)', async function (req, res) {
  console.log(`Editing`);
  let linkname = req.params.linkname;
  let links = await getLinkAsync(linkname) as Array<object>; // must be lenght = 1 or 0 because linkname is primary key
  if (links.length == 0) {
    res.render('edit', {
      title: "Create New Link",
      linkname: linkname,
      old_dest: "",
      author: req.user ? req.user.emails[0].value : "anonymous"
    });
  } else {
    let link = links[0];
    res.render('edit', {
      title: `Edit Existing Link`,
      linkname: link['linkname'], old_dest: link['dest'],
      author: link['author'],
      user: req.user,
      editable: editable(link['author'], req.user)
    });
    req.visitor.event("Edit", "Render", "", {p: linkname}).send();
  }
});

router.get('/:linkname([A-Za-z0-9-_]+)', asyncHandler(async function (req, res) {
  if (req.visitor) {
    console.log(`Set req.visitor`, req.visitor);
    req.visitor.pageview(req.originalPath).send();
  }
  let linkname = req.params.linkname;
  let links = await getLinkAsync(linkname) as Array<object>;
  if (links.length) {
    let link = links[0] as any;
    console.log('redirect to golink:', link.dest);
    res.redirect(link.dest);
    req.visitor.event("Redirect", "Hit", "Forward", {p: req.originalPath, dest: link.dest}).send();
  } else {
    console.log('Not found', 'LINK_' + req.params.linkname);
    res.render('edit', {
      title: "Create New Link",
      linkname: linkname,
      old_dest: '',
      author: req.user ? req.user.emails[0].value : "anonymous",
      editable: true
    });
    req.visitor.event("Redirect", "Miss", "ToEdit", {p: req.originalPath}).send();
  }
}));

module.exports = router;