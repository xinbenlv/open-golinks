// routes/auth.js

var express = require('express');
var router = express.Router();
var Auth0Strategy = require('passport-auth0'),
    passport = require('passport');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn();

var log4js = require('log4js');
var logger = log4js.getLogger();

// Perform the login, after login Auth0 will redirect to callback
router.get('/login',

    passport.authenticate('auth0', {scope: 'openid email profile'}), function (req, res) {
      let params = {
        ec: `Login`,
        ea: `Initiated`,
        p: req.originalUrl,
        ev: 1,
      };
      req.visitor.event(params).send();
      res.redirect("/");
    });

// Perform the final stage of authentication and redirect to '/user'
router.get('/callback',
    passport.authenticate('auth0', {
      failureRedirect: '/login'
    }),
    function(req, res) {
      if (!req.user) {
        let params = {
          ec: `Login`,
          ea: `Failure`,
          p: req.originalUrl,
          ev: 1,
        };
        req.visitor.event(params).send();
        throw new Error('user null');
      } else {
        res.redirect("/user");
        let params = {
          ec: `Login`,
          ea: `Success`,
          p: req.originalUrl,
          ev: 10,
        };
        req.visitor.event(params).send();
      }
    }
);

// Perform session logout and redirect to homepage
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
  let params = {
    ec: `Logout`,
    ea: `Success`,
    p: req.originalUrl,
    ev: 10,
  };
  req.visitor.event(params).send();
});

module.exports = router;