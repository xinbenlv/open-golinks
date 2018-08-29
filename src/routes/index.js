"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require('express');
var router = express.Router();
var Auth0Strategy = require('passport-auth0'), passport = require('passport');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn();
var mysql = require("mysql");
var connection;
if (process.env.CLEARDB_DATABASE_URL) {
    console.log("Using MySQL");
    connection = mysql.createConnection(process.env.CLEARDB_DATABASE_URL);
    var handleDisconnect_1 = function () {
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
            handleDisconnect_1();
        });
    };
    handleDisconnect_1();
    // connection.connect();
}
else {
    console.log("No MySQL specified, please set export CLEARDB_DATABASE_URL=<mysql url>");
    process.exit(1);
}
function upsertLinkAsync(linkname, dest, cb) {
    var query = "\nINSERT INTO golinks (linkname, dest, author)\nVALUES ('" + linkname + "', '" + dest + "', 'system')\nON DUPLICATE KEY UPDATE\n    dest = '" + dest + "',\n    author = 'system';\n    ";
    connection.query(query, function (err, rows, fields) {
        if (err)
            throw err;
        console.log('Result ', rows);
        cb(rows);
    });
}
function getLinkAsync(linkname, cb) {
    var query = "SELECT linkname, dest, author from golinks WHERE linkname='" + linkname + "';";
    connection.query(query, function (err, rows, fields) {
        if (err)
            throw err;
        console.log('Result ', rows);
        if (rows.length > 0) {
            cb(rows[0].dest);
        }
        else {
            cb(null);
        }
    });
}
router.get('/:linkname([A-Za-z0-9-_]+)', function (req, res) {
    if (req.visitor) {
        console.log("Set req.visitor", req.visitor);
        req.visitor.pageview(req.originalPath).send();
    }
    var linkname = req.params.linkname;
    getLinkAsync(linkname, function (dest) {
        if (dest) {
            console.log('redirect to golink:', dest);
            res.redirect(dest);
            req.visitor.event("Redirect", "Hit", "Forward", { p: req.originalPath }).send();
        }
        else {
            console.log('Not found', 'LINK_' + req.params.linkname);
            res.render('edit', { title: "Create New Link", linkname: linkname, old_dest: dest });
            req.visitor.event("Redirect", "Miss", "ToEdit", { p: req.originalPath }).send();
        }
    });
});
router.get('/edit/:linkname([A-Za-z0-9-_]+)', function (req, res) {
    console.log("Editing");
    var linkname = req.params.linkname;
    getLinkAsync(linkname, function (dest) {
        console.log('Edit golink:', linkname, dest);
        res.render('edit', { title: "Edit Existing Link", linkname: linkname, old_dest: dest });
        req.visitor.event("Edit", "Render", "", { p: linkname }).send();
    });
});
router.post('/edit', function (req, res) {
    console.log("Posting", req);
    var linkname = req.body.linkname;
    var dest = req.body.dest;
    upsertLinkAsync(linkname, dest, function (rows) {
        console.log("Done");
        req.visitor.event("Edit", "Submit", "OK", { p: linkname }).send();
        res.send('OK');
    });
});
module.exports = router;
