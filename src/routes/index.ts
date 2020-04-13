import {asyncHandler, getJWTClientAccessToekn, isEditable, myCache, myLogger} from "./utils";
import {getAllLinks, getLinksByEmailAsync, getLinksWithCache, getLinksWithMetrics, upsertLinkAsync} from "../db";
import {GOLINK_PATTERN} from "../shared";

const express = require('express');
const indexRouter = express.Router();

const mongoose = require('mongoose');
const queryString = require('query-string');
const validator = require('validator');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn();

indexRouter.get('/loaderio-0d9781efd2af91d08df854c1d6d90e7d', asyncHandler(async (req, res) => {
  res.send(`loaderio-0d9781efd2af91d08df854c1d6d90e7d`);
}));
indexRouter.get('/all-links', asyncHandler(async function (req, res) {
  let links: Array<any> = await getAllLinks() as Array<any>;
  links = await getLinksWithMetrics(links);
  res.render('links', {
    links: links
  });
}));

/* GET user profile. */
indexRouter.get('/user', ensureLoggedIn, asyncHandler(async function (req, res) {
  let links = await getLinksWithMetrics(
    await getLinksByEmailAsync(req.user.emails.map(item => item.value)) as []);
  res.render('links', {
    links: links,
    isUser: true,
  });
  return;
}));

// indexRouter.get('/edit', asyncHandler((req, res) => {
//   res.render('link-detail', {
//     title: "Create New Link",
//     golink: '',
//     oldDest: '',
//     author: req.user ? req.user.emails[0].value : "anonymous",
//     editable: true
//   });
// }));


indexRouter.get(`/dashboard/:golink(${GOLINK_PATTERN})`, asyncHandler(async (req, res) => {
  res.render('dashboard', {
    title: "Usage Dashboard",
    viewId: process.env.GA_VIEW_ID,
    lockedUrl: req.params.golink,
    accessToken: await getJWTClientAccessToekn()
  });
}));

indexRouter.get('/dashboard', async (req, res) => {
  res.render('dashboard', {
    title: "Usage Dashboard",
    viewId: process.env.GA_VIEW_ID,
    accessToken: await getJWTClientAccessToekn()
  });
});


indexRouter.post('/edit', asyncHandler(async function (req, res) {
  const regexPattern = RegExp(`^${GOLINK_PATTERN}$`);
  if (!validator.isURL(req.body.dest)) {
    res.status(400).send(`Bad Request, invalid URL: ${req.body.dest}`);
  } else if (!regexPattern.test(req.body.golink)) {
    res.status(400).send(`Bad Request, invalid golink: ${req.body.golink}`);
  } else {
    let golink = req.body.golink;
    let dest = req.body.dest;
    let addLogo = req.body.addLogo;
    let caption = req.body.caption;
    let author = req.user ? req.user.emails[0].value : 'anonymous';
    // Check if links can be updated. // also need to worry about trace
    let links = await getLinksWithCache(golink) as Array<any>;
    if (links.length == 0/*link doen't exist*/ || isEditable(links[0].author, req.user)) {
      await upsertLinkAsync(
        golink,
        dest,
        author,
        addLogo,
        caption);
      myLogger.info(`Done`);

      let params = {
        ec: `Edit`,
        ea: `Submit`,
        el: `OK`,
        p: golink, // page
        ev: 10,
      };
      req.visitor.event(params).send();
      res.render('link-detail', {
          title: `Edit`,
          msg: 'Your link is created/updated successsfully!',
          msgType: "success",
          golink: golink,
          oldDest: dest,
          author: author,
          addLogo: addLogo,
          caption: caption,
          user: req.user,
          editable: isEditable(author, req.user)
        }
      );
    } else {
      res.status(403).send(`You don't have permission to edit ${process.env.OPEN_GOLINKS_SITE_HOST}/${golink} which belongs to user:${links[0].author}.`);

    }
  }

}));

indexRouter.get(`/edit/:golink(${GOLINK_PATTERN})`, asyncHandler(async function (req, res) {
  let golink = req.params.golink;
  let links = await getLinksWithCache(golink) as Array<object>; // must be lenght = 1 or 0 because golink is primary key
  if (links.length == 0) {
    res.render('link-detail', {
      msg: "Create new link",
      title: 'Create',
      golink: golink,
      oldDest: "",
      author: req.user ? req.user.emails[0].value : "anonymous",
      editable: true
    });
  } else {
    let link = links[0];
    res.render('link-detail', {
      title: `Edit`,
      golink: link['golink'], oldDest: link['dest'],
      author: link['author'],
      addLogo: link['addLogo'],
      caption: link['caption'],
      user: req.user,
      editable: isEditable(link['author'], req.user)
    });

    let params = {
      ec: `Edit`,
      ea: `Render`,
      el: ``,
      p: golink, // page
      ev: 20,
    };
    req.visitor.event(params).send();
  }
}));

indexRouter.get('/tencent5563221124109059836.txt', function (req, res) {
  // 进行微信申诉，微信所要求的的站长认证机制
  res.setHeader('Content-Type', 'text/txt');
  res.setHeader('Content-Disposition', 'attachment; filename=\"' + 'tencent5563221124109059836.txt\"');
  res.send(`12849895376138040179`);
});

export default indexRouter;
