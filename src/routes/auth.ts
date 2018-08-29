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
      res.redirect("/");
    });

// Perform the final stage of authentication and redirect to '/user'
router.get('/callback',function(req, res, next) {
  passport.authenticate('auth0', function(err, user, info) {
    if (err) {
      logger.error(err);
      return next(err);
    }
    if (!user) {
      console.log(`XXX Callback!!! user`, user);
      console.log(`XXX Callback!!! info`, info);
      console.log(`XXX Callback!!! err`, err);
      console.log(`XXX Destroy session!!! err`, err);
      return res.redirect('/login');
    }
    req.logIn(user, function(err) {
      if (err) { return next(err); }
      return res.redirect('/user');
    });
  })(req, res, next);
}
    // passport.authenticate('auth0', {
    //   successRedirect : '/user',
    //   failureRedirect : '/login',
    //   failureFlash : true
    // })
);

// Perform session logout and redirect to homepage
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

module.exports = router;