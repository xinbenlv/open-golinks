var express = require('express');
var router = express.Router();

const queryString = require('query-string');
const rp = require('request-promise');
const validator = require('validator');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn();
const MongoClient = require('mongodb').MongoClient;

const LINKNAME_PATTERN = '[A-Za-z0-9-_]+';
var log4js = require('log4js');
var logger = log4js.getLogger();

const NodeCache = require("node-cache");
const myCache = new NodeCache();

const asyncHandler = fn => (req, res, next) =>
    Promise
        .resolve(fn(req, res, next))
        .catch(next);

let dbInstance = null; // global

const maybeReconnect = async () => {
  if (dbInstance) {
    return dbInstance;
  } else {
    return new Promise(((resolve, reject) => {
      MongoClient.connect(process.env.MONGODB_URI, (err, client) => {
        if (err) reject(err);
        else resolve(client.db(`heroku_pts10rxp`));
      });
    }));

  }
};

let editable = function (existingLinkAuthor, reqeustingUser) {
  logger.debug(`Author: ${existingLinkAuthor}`, 'user', reqeustingUser);
  if (existingLinkAuthor === 'anonymous' && reqeustingUser && process.env.ALLOW_OVERRIDE_ANONYMOUS === 'true') return true;
  else if (reqeustingUser && reqeustingUser.emails.map(i => i.value).indexOf(existingLinkAuthor) >= 0) {
    return true;
  }
  return false;
};

let upsertLinkAsync = async function (linkname, dest, author) {
  logger.debug(`Updating linkname`);
  myCache.del(linkname);
  logger.debug(`Removed cahce for linkname`);
  dbInstance = await maybeReconnect();

  const collection = dbInstance.collection('shortlinks');
  return await collection.updateOne(
      {linkname: linkname},
      { $set: {linkname: linkname, dest: dest, author: author, time: new Date()} },
      {upsert: true});

};

let getLinksWithCache = async (linkname) => {
  let value = myCache.get(linkname);
  if (value !== undefined) {
    logger.debug(`cache hit for ${linkname}`);
    return value;
  } else {
    logger.debug(`cache missed for ${linkname}`);
    // handle miss!
    let originalValue = getLinksFromDBByLinknameAsync(linkname);
    myCache.set(linkname, originalValue);
    logger.debug(`cache set for ${linkname}`);
    return originalValue;
  }
};

let getLinksFromDBByLinknameAsync = async (linkname) => {
  dbInstance = await maybeReconnect();
  const collection = dbInstance.collection('shortlinks');
  let ret = await collection.findOne({linkname: linkname}, {
    projection: {
      linkname: true,
      dest: true,
      author: true,
      createdTime: true,
      updatedTime: true
    }
  });
  logger.debug(`getLinksFromDBByLinknameAsync linkname = ${linkname}, ret = ${JSON.stringify(ret, null, 2)}`);
  return [ret] || [];

};

let getLinksByEmailAsync = async function (emails) {
  dbInstance = await maybeReconnect();
  const collection = dbInstance.collection('shortlinks');
  logger.debug(`emails ${JSON.stringify(emails, null, 2)}`);
  let ret = await collection.find({author: {'$in': emails}}, {
    projection: {
      linkname: true,
      dest: true,
      author: true,
      createdTime: true,
      updatedTime: true
    }
  });
  let t = ret.toArray();
  logger.debug(`getLinksByEmailAsync ret = ${JSON.stringify(t, null, 2)}`);
  return t;

};

let getAllLinks = async function () {
  dbInstance = await maybeReconnect();
  const collection = dbInstance.collection('shortlinks');
  return (await collection.find({}, {
    projection: {
      linkname: true,
      dest: true,
      author: true,
      createdTime: true,
      updatedTime: true
    },
    limit: 10
  })).toArray();
};

router.get('/loaderio-0d9781efd2af91d08df854c1d6d90e7d', asyncHandler(async (req, res) => {
  res.send(`loaderio-0d9781efd2af91d08df854c1d6d90e7d`);
}));
router.get('/all-links', asyncHandler(async function (req, res) {
  let links: Array<any> = await getAllLinks() as Array<any>;
  links = await getLinksWithMetrics(links);
  res.render('links', {
    links: links
  });
}));


let getJWTClientAccessToekn = async function () {
  const {JWT} = require('google-auth-library');
  let decoded = Buffer.from(process.env.GOOGLE_JSON_KEY, 'base64').toString();
  const keys = JSON.parse(decoded);
  const client = new JWT(
      keys.client_email,
      null,
      keys.private_key,
      [
        `https://www.googleapis.com/auth/analytics.readonly`
      ],
  );
  return new Promise((resolve, reject) => {
    client.authorize((err, result) => {
      if (err) {
        reject(err);
      } else
        resolve(result.access_token);

    });
  });
};
let getLinksWithMetrics = async function (links) {
  if (links.length == 0) return links;
  let access_token = await getJWTClientAccessToekn();
  const baseUrlV4 = `https://analyticsreporting.googleapis.com/v4/reports:batchGet?`;
  let queryV4 = `{
 "reportRequests": [
  {
   "viewId": "${process.env.GA_VIEW_ID}",
   "dimensions": [
    {
     "name": "ga:pagePath"
    }
   ],
   "metrics": [
    {
     "expression": "ga:pageviews"
    }
   ],
   "dimensionFilterClauses": [
    {
     "filters": [
      {
       "operator": "IN_LIST",
       "dimensionName": "ga:pagePath",
       "expressions": ${JSON.stringify(links.map(l => '/' + l['linkname']))}
      }
     ]
    }
   ],
   "dateRanges": [
    {
     "startDate": "2005-12-31",
     "endDate": "2019-09-28"
    }
   ]
  }
 ]
}`;

  let optionV4 = {
    uri: baseUrlV4 + `access_token=${access_token}`,
    method: 'POST',
    body: JSON.parse(queryV4),
    json: true
  };
  let retV4 = await rp(optionV4);

  let urlToPageviewMap = {};
  retV4['reports'][0]['data']['rows'].forEach(d => {
    let url = d['dimensions'][0];
    let pageViews = d['metrics'][0]['values'][0];
    urlToPageviewMap[url] = pageViews;
  });

  links.forEach(l => {
    l['pageViews'] = urlToPageviewMap['/' + l['linkname']]
  });
  return links;
};

/* GET user profile. */
router.get('/user', ensureLoggedIn, asyncHandler(async function (req, res) {
  let links = await getLinksWithMetrics(
      await getLinksByEmailAsync(req.user.emails.map(item => item.value)) as []);
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

router.get(`/dashboard/:linkname(${LINKNAME_PATTERN})`, async (req, res) => {
  res.render('dashboard', {
    title: "Usage Dashboard",
    viewId: process.env.GA_VIEW_ID,
    lockedUrl: req.params.linkname,
    accessToken: await getJWTClientAccessToekn()
  });
});

router.get('/dashboard', async (req, res) => {
  res.render('dashboard', {
    title: "Usage Dashboard",
    viewId: process.env.GA_VIEW_ID,
    accessToken: await getJWTClientAccessToekn()
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
    if (links.length == 0/*link doen't exist*/ || editable(links[0].author, req.user)) {
      await upsertLinkAsync(linkname, dest, req.user ? req.user.emails[0].value : 'anonymous');
      logger.info(`Done`);

      let params = {
        ec: `Edit`,
        ea: `Submit`,
        el: `OK`,
        p: linkname, // page
        ev: 10,
      };
      req.visitor.event(params).send();
      res.send(`Edit/Update succeeded, updated Link ${process.env.OPEN_GOLINKS_SITE_HOST}/${linkname} to url = ${dest}`);
    } else {
      res.status(403).send(`You don't have permission to edit ${process.env.OPEN_GOLINKS_SITE_HOST}/${linkname} which belongs to user:${links[0].author}.`);

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

    let params = {
      ec: `Edit`,
      ea: `Render`,
      el: ``,
      p: linkname, // page
      ev: 20,
    };
    req.visitor.event(params).send();
  }
});

router.get(`/:linkname(${LINKNAME_PATTERN})`, asyncHandler(async function (req, res) {
  if (req.visitor) {
    logger.debug(`req.visitor is set to `, req.visitor, 'now logging pageview to ', req.originalUrl, req.query.nocache);
  }

  let linkname = req.params.linkname;
  let links;
  if (req.query.nocache) {
    logger.info(`Forced nocache for ${linkname}`);
    links = await getLinksFromDBByLinknameAsync(linkname) as Array<object>;
  } else {
    links = await getLinksWithCache(linkname) as Array<object>;
  }

  if (links.length) {
    let link = links[0] as any;
    logger.info('redirect to golink:', link.dest);

    res.redirect(link.dest);
    let params = {
      ec: `Redirect`,
      ea: `Hit`,
      el: `Forward`,
      p: req.originalUrl,
      dest: link.dest,
      ev: 1,
    };
    req.visitor.event(params).send();
  } else {
    logger.info('Not found', 'LINK_' + req.params.linkname);
    res.render('edit', {
      title: "Create New Link",
      linkname: linkname,
      old_dest: '',
      author: req.user ? req.user.emails[0].value : "anonymous",
      editable: true
    });

    let params = {
      ec: `Redirect`,
      ea: `Miss`,
      el: `ToEdit`,
      p: req.originalUrl,
      ev: 1,
    };
    req.visitor.event(params).send();
  }
}));

router.get('/', asyncHandler(async function (req, res) {
  res.redirect('/edit');
}));


module.exports = router;