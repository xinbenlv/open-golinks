require('dotenv').config();
import {myLogger} from "./routes/utils";
import config from '../nuxt.config';
const {version, name} = require('./../package.json');
myLogger.debug(`App: ${name}, version ${version}`);

const {Nuxt, Builder} = require('nuxt');
const express = require("express");
import * as bodyParser from "body-parser";
import * as crypto from 'crypto';
import axios from 'axios';

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
  "GA_MEASUREMENT_ID",
  "GA_API_SECRET",
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

// app.js

const session = require('express-session');

const main = async () => {
//session-related stuff
  var sess = {
    secret: 'some cool secret',
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 小时
      sameSite: 'lax'  // 重要：防止 CSRF，同时允许 OAuth 回调
    },
    resave: false,
    saveUninitialized: true,
    name: 'sessionId' // 明确指定 cookie 名称
  };

  if (app.get('env') === 'production') {
    console.log(`[main.ts] [debug] ==> session cookie secure is true because app.get('env') === 'production'`);
    sess.cookie['secure'] = true; // only enable in production
  } else {
    console.log(`[main.ts] [debug] ==> session cookie secure is false because app.get('env') !== 'production' but is ${app.get('env')}`);
  }

  // app.js
  config.dev = !(process.env.NODE_ENV === 'production');
  const nuxt = new Nuxt(config);
  const {host, port} = nuxt.options.server;

  app.use(cookieParser());
  app.use(session(sess));

  app.use((req, res, next) => {
    console.log('[main.ts] [debug] ==> session:', req.session);
    next();
  });

  const passport = require('passport');
  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (user, done) {
    done(null, user);
  });
  const Auth0Strategy = require('passport-auth0');

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
      console.log('[main.ts] [debug] ==> Auth0Strategy verify called');
      console.log('[main.ts] [debug] ==> accessToken:', accessToken);
      console.log('[main.ts] [debug] ==> profile:', profile);
      console.log('[main.ts] [debug] ==> extraParams:', extraParams);
      return done(null, profile);
    }
  );

  passport.use(strategy);
  app.use(passport.initialize());
  app.use(passport.session());



// Look up session to know if user is logged in
  app.use(function (req: any, res: any, next) {
    res.locals.loggedIn = false;
    if (req.session.passport && typeof req.session.passport.user != 'undefined') {
      res.locals.loggedIn = true;
    }
    myLogger.debug(`Result:`, res.locals.loggedIn);
    next();
  });

  app.use(async (req: any, res: any, next: any) => {
    // Skip the following routes
    const skipRoutes = [
      '/favicon.ico',
      '/_nuxt/.*',
      '/__webpack_hmr',
      '/api/.*'
    ];
    if (skipRoutes.some(route => new RegExp(route).test(req.originalUrl))) {
      myLogger.debug(`Skipping GA4 tracking for ${req.originalUrl}`);
      return next();
    }

    myLogger.debug(`Start GA4 tracking for ${req.originalUrl}`);
    try {
      // Get or generate client ID
      let clientId = req.cookies._ga?.replace(/^GA\d\.\d\./, '');
      
      // If no client ID exists, generate one and set the cookie
      if (!clientId) {
        // Generate a random UUID-like string
        clientId = crypto.randomBytes(16).toString('hex');
        // Set cookie with 2 year expiration (similar to GA's default)
        res.cookie('_ga', `GA1.1.${clientId}`, {
          maxAge: 63072000000, // 2 years in milliseconds
          httpOnly: true,
          secure: app.locals.siteProtocol === 'https',
          sameSite: 'lax'
        });
      }

      // Prepare event data
      const eventData = {
        client_id: clientId,
        user_id: req.user?.emails?.[0],
        events: [{
          name: 'visit',
          params: {
            page_location: `${app.locals.siteProtocol}://${app.locals.siteHost}${req.originalUrl}`,
            page_path: req.originalUrl,
            page_title: req.originalUrl,
            engagement_time_msec: "100"
          }
        }]
      };
      myLogger.info(`Sending event data: ${JSON.stringify(eventData)}`);

      await axios.post(
        `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA4_MEASUREMENT_ID}&api_secret=${process.env.GA4_API_SECRET}`,
        eventData
      ); // TODO do not wait for response in production

      next();
    } catch (error) {
      myLogger.error('GA4 tracking error:', error);
      next();
    }
  });

  if (process.env.LETS_ENCRYPT_URL_PART && process.env.LETS_ENCRYPT_CONTENT) {
    app.get(process.env.LETS_ENCRYPT_URL_PART, function(req, res) {
      return res.send(process.env.LETS_ENCRYPT_CONTENT)
    });
  }

  app.use('/', authRouter);
  app.use('/healthz', (req, res) => {
    res.status(200).json({
      status: 'OK',
      version,
      name,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      os: process.platform,
      osVersion: process.version,
      nodeVersion: process.version,
    });
  });
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
