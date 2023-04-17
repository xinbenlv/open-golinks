import {asyncHandler, myLogger} from "./utils";
import {getLinksFromDBByLinknameAsync, getLinksWithCache} from "../db";
import {GOLINK_PATTERN} from '../shared';

const express = require('express');
const indexRouter = express.Router();

indexRouter.get('/loaderio-0d9781efd2af91d08df854c1d6d90e7d', asyncHandler(async (req, res) => {
  res.send(`loaderio-0d9781efd2af91d08df854c1d6d90e7d`);
}));

indexRouter.get('/tencent5563221124109059836.txt', function (req, res) {
  // 进行微信申诉，微信所要求的的站长认证机制
  res.setHeader('Content-Type', 'text/txt');
  res.setHeader('Content-Disposition', 'attachment; filename=\"' + 'tencent5563221124109059836.txt\"');
  res.send(`12849895376138040179`);
});

const addRouteForRedirect = () => {
  // Exclude things in the `nuxt.config.js` router
  indexRouter.get(`/:goLink(${GOLINK_PATTERN})?`, asyncHandler(async (req, res, next) => {
    let links;
    let goLink = req.params.goLink;

    // TODO: this is a hack to avoid redirecting to the dashboard or edit earler than the nuxt router
    if (goLink == 'edit') {
      next();
      return;
    } else if (goLink == 'dashboard') {
      next();
    }

    if (req.query.nocache) {
      myLogger.info(`Forced nocache for ${goLink}`);
      links = await getLinksFromDBByLinknameAsync(goLink) as Array<object>;
    } else {
      links = await getLinksWithCache(goLink) as Array<object>;
    }
    if (links.length > 0) {
      let link = links[0];
      console.log(`Redirecting to ${link['url']}`);
      res.redirect(link.goDest);

    } else {
      res.redirect(`/edit/${goLink}`);
    }
  }));
}

myLogger.info(`Redirect mode is ${process.env.REDIRECT_MODE}`);

if (process.env.REDIRECT_MODE === 'direct') {
  addRouteForRedirect();
} else { 
  // Doing nothing for other modes
}

export default indexRouter;
