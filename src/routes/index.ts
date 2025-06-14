import {asyncHandler, myLogger} from "./utils";
import {getLinksFromDBByLinknameAsync, getLinksWithCache} from "../db";
import {GOLINK_PATTERN} from '../shared';

const express = require('express');
const indexRouter = express.Router();

function shouldShowWarning(req): boolean { 
  let dice = Math.random();
  let warningRatio = parseFloat(process.env.REDIRECT_WARNING_RATIO);

  // if dice < ratio, show warning, which is a small probability
  const shouldShowWarning = dice < warningRatio;

  myLogger.info(
    `REDIRECT_WARNING_RATIO=${warningRatio}, ${dice}, dice < ratio = ${dice < warningRatio}, shouldShowWarning = ${shouldShowWarning}`);
  
  return shouldShowWarning;
}

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
  indexRouter.get('/', asyncHandler(async (req, res) => {
    res.redirect(`/edit`);
  }));
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
      return;
    } else if (goLink == 'user-links') {
      next();
      return;
    } else if (goLink == '') {
      res.redirect(`/edit`);
      return;
    }

    if (req.query.nocache) {
      myLogger.info(`Forced nocache for ${goLink}`);
      links = await getLinksFromDBByLinknameAsync(goLink) as Array<object>;
    } else {
      links = await getLinksWithCache(goLink) as Array<object>;
    }

    if (links.length > 0) {
      let link = links[0];

      // show user
      if (shouldShowWarning(req)) {
        console.log(`Showing warning for ${link.goDest}`);
        next(); // fall through to the nuxt router to show the warning
        return;
      } else {
        console.log(`No warning, directly redirecting to ${link.goDest}`);
        res.redirect(link.goDest); // directly redirect to the destination
        return;
      }
      return;
    } else {
      res.redirect(`/edit/${goLink}`);
      return;
    }
  }));
}

myLogger.info(`REDIRECT_WARNING_RATIO is ${process.env.REDIRECT_WARNING_RATIO}`);

addRouteForRedirect();

export default indexRouter;
