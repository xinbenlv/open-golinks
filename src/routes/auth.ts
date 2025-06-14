// routes/auth.js

const express = require('express');
const authRouter = express.Router();
const passport = require('passport');

authRouter.use((req, res, next) => {
  if (req.isAuthenticated() && req.user) {
    res.locals.isAuthenticated = req.isAuthenticated();
    res.locals.user = {
      id: req.user.id,
      username: req.user._json.username,
      grants: req.user._json.grants
    };
  }
  next();
});

// Perform the login, after login Auth0 will redirect to callback
authRouter.get('/login', (req, res, next) => {
  console.log('[authRouter /login] [debug] ==> sessionID:', req.sessionID);
  console.log('[authRouter /login] [debug] ==> session:', req.session);
  // 获取 returnTo 参数，默认为 '/'
  const returnTo = req.query.returnTo || '/';
  req.session.returnTo = returnTo;
  // 调用 passport.authenticate 并传递 state
  passport.authenticate('auth0', { 
    scope: 'openid email profile',
    audience: process.env.AUTH0_AUDIENCE,
    redirectUri: `${process.env.OPEN_GOLINKS_SITE_PROTOCOL}://${process.env.OPEN_GOLINKS_SITE_HOST_AND_PORT}/callback`
  })(req, res, next);
}, function (req, res) {
  let params = {
    ec: `Login`,
    ea: `Initiated`,
    p: req.originalUrl,
    ev: 1,
  };
  req.visitor?.event(params)?.send();
  res.redirect("/");
});

// Perform the final stage of authentication and redirect to '/user'
authRouter.get('/callback',
  (req, res, next) => {
    console.log('[authRouter /callback] [debug] ==> /callback route hit, query:', req.query);
    console.log('[authRouter /callback] [debug] ==> sessionID:', req.sessionID);
    console.log('[authRouter /callback] [debug] ==> session:', req.session);
    next();
  },
  (req, res, next) => {
    passport.authenticate('auth0', (err, user, info) => {
      console.log('[authRouter /callback] [debug] ==> authenticate callback');
      console.log('[authRouter /callback] [debug] ==> err:', err);
      console.log('[authRouter /callback] [debug] ==> user:', user);
      console.log('[authRouter /callback] [debug] ==> info:', info);
      
      if (err) { return next(err); }
      if (!user) { return res.redirect('/login'); }
      
      req.logIn(user, (err) => {
        if (err) { return next(err); }
        // 成功登录后的逻辑
        // 从 session 中获取 returnTo
        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo; // 用完删除
        return res.redirect(returnTo);
      });
    })(req, res, next);
  }
);

// Perform session logout and redirect to homepage
authRouter.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
  let params = {
    ec: `Logout`,
    ea: `Success`,
    p: req.originalUrl,
    ev: 10,
  };
  req.visitor?.event(params)?.send();
});

export default authRouter;
