
require('dotenv').config();
import {myLogger} from "./routes/utils";
import config from '../nuxt.config';
const {version, name} = require('./../package.json');
myLogger.debug(`App: ${name}, version ${version}`);

const {Nuxt, Builder} = require('nuxt');
const express = require("express");
import * as ua from "universal-analytics";
import * as bodyParser from "body-parser";

import indexRouter from "./routes/index";
import authRouter from "./routes/auth";
import qrRouter from "./routes/qr";
import apiV2Router from "./routes/apiv2";
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

let PORT = process.env.PORT || 3000;
let app = express();
app.use('/static', express.static('static'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(require('express-status-monitor')());

[
  "OPEN_GOLINKS_GA_ID",
  "OPEN_GOLINKS_SITE_NAME",
  "OPEN_GOLINKS_SITE_HOST_AND_PORT",
  "MONGODB_URI",
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "GOOGLE_JSON_KEY",
  "ALLOW_OVERRIDE_ANONYMOUS",
  "GA_VIEW_ID",
  "HOST",
].forEach((i)=>{
  console.assert(`Env var process.env.${i} is required but not set.`)
});

myLogger.debug(`Setting Google Analytics with Tracking Id = `, process.env.OPEN_GOLINKS_GA_ID);
app.locals.siteName = process.env.OPEN_GOLINKS_SITE_NAME || `Open GoLinks`;
app.locals.siteHost = process.env.OPEN_GOLINKS_SITE_HOST_AND_PORT || `localhost:3000`;
app.locals.siteProtocol = process.env.OPEN_GOLINKS_SITE_PROTOCOL || `http`;
const Auth0Strategy = require('passport-auth0'),
  passport = require('passport');

//passport-auth0
const strategy = new Auth0Strategy({
    domain: process.env.AUTH0_DOMAIN,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET, // Replace this with the client secret for your app
    callbackURL: `${app.locals.siteProtocol}://${app.locals.siteHost}/callback`, // TODO: callback HTTPS instead of HTTP
  },
  function (accessToken, refreshToken, extraParams, profile, done) {
    // accessToken is the token to call Auth0 API (not needed in the most cases)
    // extraParams.id_token has the JSON Web Token
    // profile has all the information from the user
    return done(null, profile);
  }
);

passport.use(strategy);

// app.js

const session = require('express-session');

const main = async () => {
//session-related stuff
  var sess = {
    secret: 'some cool secret', // TODO use another one
    cookie: {},
    resave: false,
    saveUninitialized: true
  };

// If enable, it will fail and login again and again
// if (app.get('env') === 'production') {
//   sess.cookie['secure'] = true; // serve secure cookies, requires https
// }

// app.js
  config.dev = !(process.env.NODE_ENV === 'production');
  const nuxt = new Nuxt(config);
  const {host, port} = nuxt.options.server;

  app.use(cookieParser());

  app.use(session(sess));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (user, done) {
    done(null, user);
  });

// Look up session to know if user is logged in
  app.use(function (req: any, res: any, next) {
    myLogger.debug(`Query if it's logged in`, req.session);
    res.locals.loggedIn = false;
    if (req.session.passport && typeof req.session.passport.user != 'undefined') {
      res.locals.loggedIn = true;
    }
    myLogger.debug(`Result:`, res.locals.loggedIn);
    next();
  });
  
  app.use(ua.middleware(process.env.OPEN_GOLINKS_GA_ID, {cookieName: '_ga'}));
  app.use((req: any, res: any, next: any) => {
    if (req.user && req.user.emails) {
      req.visitor.set('uid', req.user.emails[0]); // TODO(zzn): consider use a HASH fucntion instead
      myLogger.debug(`set uid for req.visitor`, req.visitor);
    }
    // Log pageview for all requests
    req.visitor.pageview(req.originalUrl).send();

    next()
  });
  app.use('/', authRouter);
  app.use('/qr', qrRouter);
  await mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true});

  myLogger.debug('Connected');

  await nuxt.ready();

  // Build only in dev mode
  if (process.env.BUILD_CLIENT === '1' && config.dev) {
    myLogger.info(`Running Nuxt Builder ... `);
    const builder = new Builder(nuxt);
    await builder.build();
    myLogger.info(`DONE built nuxt... `);
  } else {
    myLogger.info(`NOT Running Nuxt Builder`);
  }

  app.use('/api/v2', apiV2Router);

  app.use(nuxt.render);

  myLogger.debug('Start listening on ', PORT);
  app.listen(PORT);
};

main().then(() => {
  console.log(`Main done!`);
});
