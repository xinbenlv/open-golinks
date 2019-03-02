var express = require('express');
var router = express.Router();
const Auth0Strategy = require('passport-auth0');
const passport = require('passport');

const validator = require('validator');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn();
const SqlString = require('sqlstring');
import * as mysql from "mysql";

const LINKNAME_PATTERN = '[A-Za-z0-9-_]+';
let connection;
var log4js = require('log4js');
var logger = log4js.getLogger();

const NodeCache = require( "node-cache" );
const myCache = new NodeCache();

const asyncHandler = fn => (req, res, next) =>
    Promise
        .resolve(fn(req, res, next))
        .catch(next);

const reconnect = () => {
  let  _connection = mysql.createConnection(process.env.CLEARDB_DATABASE_URL);
  _connection.connect();
  logger.info('\nRe-connected lost mysql connection');
  return _connection;
};

const handleDisconnect = () => {
  connection.on('error', function (err) {
    logger.warn('Handling mysql err', err);
    if (!err.fatal) {
      return;
    }
    if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
      throw err;
    }

    logger.info('\nRe-connecting lost connection: ' + err.stack);
    connection = reconnect();
    handleDisconnect();
  });
};

if (process.env.CLEARDB_DATABASE_URL) {
  logger.debug(`Using MySQL`);
  connection = mysql.createConnection(process.env.CLEARDB_DATABASE_URL);
  handleDisconnect();
} else {
  logger.warn(`No MySQL specified, please set export CLEARDB_DATABASE_URL=<mysql url>`);
  process.exit(1);
}

let editable = function (author, user) {
  logger.debug(`Author: ${author}`, 'user', user);
  if (author === 'anonymous') return true;
  else if (user && user.emails.map(i => i.value).indexOf(author) >= 0) {
    return true;
  }
  return false;
};
let upsertLinkAsync = async function (linkname, dest, author) {
  logger.debug(`Updating linkname`);
  myCache.del( linkname );
  logger.debug(`Removed cahce for linkname`);
  let query = `
INSERT INTO golinks (linkname, dest, author)
VALUES (${SqlString.escape(linkname)}, ${SqlString.escape(dest)}, ${SqlString.escape(author)})
ON DUPLICATE KEY UPDATE
    dest = ${SqlString.escape(dest)},
    author = ${SqlString.escape(author)};
    `;
  return new Promise((resolve, reject) => {
    connection.query(query, function (err, rows) {
      if (err) reject(err);
      else resolve(rows);
    })
  });
};

let getLinksWithCache = async (linkname) => {
  let value = myCache.get( linkname);
  if ( value !== undefined ) {
    logger.debug(`cache hit for ${linkname}`);
    return value;
  } else {
    logger.debug(`cache missed for ${linkname}`);
    // handle miss!
    let originalValue = getLinksAsync(linkname);
    myCache.set(linkname, originalValue);
    logger.debug(`cache set for ${linkname}`);
    return originalValue;
  }
};

let getLinksAsync = async (linkname) => {
  let query = `SELECT linkname, dest, author from golinks WHERE linkname=${SqlString.escape(linkname)};`;

  return new Promise((resolve, reject) => {
    connection.query(query, function (err, rows, fields) {
      if (err) {
        logger.warn(err.message);
        if (/after fatal error/.test(err.message)) {
          // retry connection
          // TODO(xinbenlv): consider apply similar case
          connection = reconnect();
          connection.query(query, function (err, rows, fields) {
            if (err)  reject (err);
            else resolve(rows);
          });
          // if failed again, we will let it fail and report.
        } else {
          reject(err);
        }
      }
      else resolve(rows);
    })
  });

};

let getLinksByEmailAsync = async function (emails) {
  let emailsWhereClause = emails.map(v => `${SqlString.escape(v)}`).join(',');
  let query = `SELECT linkname, dest, author from golinks WHERE author in (${emailsWhereClause});`;
  return new Promise(function (resolve, reject) {
    connection.query(query, (err, rows) => {
      if (err) reject(err);
      else {
        resolve(rows);
      }
    });
  });
};

let getAllLinks = async function () {
  let query = `SELECT linkname, dest, author from golinks LIMIT 10;`;
  return new Promise(function (resolve, reject) {
    connection.query(query, (err, rows) => {
      if (err) reject(err);
      else {
        resolve(rows);
      }
    });
  });
};

router.get('/all-links', asyncHandler(async function (req, res) {
  let links = await getAllLinks() as Array<any>;
  res.render('links', {
    links: links
  });
}));

/* GET user profile. */
router.get('/user', ensureLoggedIn, asyncHandler(async function (req, res) {
  let links = await getLinksByEmailAsync(req.user.emails.map(item => item.value));
  res.render('links', {
    links: links,
    isUser: true,
  });
  return;
}));

router.get('/edit', (req, res) => {
  res.render('edit', {
    title: "Create New Link",
    linkname: '',
    old_dest: '',
    author: req.user ? req.user.emails[0].value : "anonymous",
    editable: true
  });
});

router.post('/edit', asyncHandler(async function (req, res) {
  var regexPattern = RegExp(`^${LINKNAME_PATTERN}$`);
  if (!validator.isURL(req.body.dest)) {
    res.status(400).send(`Bad Request, invalid URL: ${req.body.dest}`);
  } else if (!regexPattern.test(req.body.linkname)) {
    res.status(400).send(`Bad Request, invalid linkname: ${req.body.linkname}`);
  } else {
    let linkname = req.body.linkname;
    let dest = req.body.dest;
    // Check if links can be updated. // also need to worry about trace
    let links = await getLinksWithCache(linkname) as Array<any>;
    console.log(`edit XXX Links`, JSON.stringify(links, null, '  '));
    if (links.length && links[0].author != "anonymous" && req.user && req.user.emails.map(i => i.value).indexOf(links[0].author) < 0) {
      res.status(403).send(`You don't have permission to edit ${linkname} which belongs to ${links[0].author}.`);
    } else {
      console.log(`edit XXX Links good: 
      links.length=${links.length}, 
      links[0].author != "anonymous"=${links[0].author != "anonymous"}
      req.user = ${req.user}
      req.user.emails.map(i => i.value).indexOf(links[0].author) < 0 = ${req.user.emails.map(i => i.value).indexOf(links[0].author) < 0}
      links = ${links}
      `);
      await upsertLinkAsync(linkname, dest, req.user ? req.user.emails[0].value : 'anonymous');
      logger.info(`Done`);
      req.visitor.event("Edit", "Submit", "OK", {p: linkname}).send();
      res.send('OK');
    }
  }

}));

router.get(`/edit/:linkname(${LINKNAME_PATTERN})`, async function (req, res) {
  let linkname = req.params.linkname;
  let links = await getLinksWithCache(linkname) as Array<object>; // must be lenght = 1 or 0 because linkname is primary key
  if (links.length == 0) {
    res.render('edit', {
      title: "Create New Link",
      linkname: linkname,
      old_dest: "",
      author: req.user ? req.user.emails[0].value : "anonymous",
      editable: true
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

router.get(`/:linkname(${LINKNAME_PATTERN})`, asyncHandler(async function (req, res) {
  if (req.visitor) {
    logger.debug(`req.visitor is set to `, req.visitor, 'now logging pageview to ', req.originalUrl, req.query.nocache);
    req.visitor.pageview(req.originalUrl).send();
  }
  let linkname = req.params.linkname;
  let links;
  if (req.query.nocache) {
    links = await getLinksAsync(linkname) as Array<object>;
  } else {
    links = await getLinksWithCache(linkname) as Array<object>;
  }

  if (links.length) {
    let link = links[0] as any;
    logger.info('redirect to golink:', link.dest);
    res.redirect(link.dest);
    req.visitor.event("Redirect", "Hit", "Forward", {p: req.originalUrl, dest: link.dest}).send();
  } else {
    logger.info('Not found', 'LINK_' + req.params.linkname);
    res.render('edit', {
      title: "Create New Link",
      linkname: linkname,
      old_dest: '',
      author: req.user ? req.user.emails[0].value : "anonymous",
      editable: true
    });
    req.visitor.event("Redirect", "Miss", "ToEdit", {p: req.originalUrl}).send();
  }
}));

router.get('/', asyncHandler(async function (req, res) {
  res.redirect('/edit');
}));


module.exports = router;