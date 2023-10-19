import {asyncHandler, myLogger} from "./utils";
import {getLinksFromDBByLinknameAsync, getLinksWithCache} from "../db";
import {GOLINK_PATTERN} from '../shared';

const express = require('express');
const indexRouter = express.Router();

function shouldShowWarning(req): boolean { 
  let dice = Math.random();
  let ratio = parseFloat(process.env.REDIRECT_WARNING_RATIO);

  myLogger.info(
    `REDIRECT_WARNING_RATIO=${ratio}, ${dice}, dice < ratio = ${dice < ratio}`);
  
  if (dice < ratio) {
    return false;
  } else {
    return true;
  }
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
      console.log(`Redirecting to ${link['url']}`);

      // show user
      if (shouldShowWarning(req)) {
        next(); // fall through to the nuxt router to show the warning
        return;
      } else {
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
