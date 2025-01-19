import {GOLINK_PATTERN} from "../shared";
import {asyncHandler, isEditable, myLogger} from "./utils";
import {getLinksFromDBByLinknameAsync, getLinksWithCache, upsertLinkAsync} from "../db";
import * as mongoose from 'mongoose';
const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const analyticsDataClient = new BetaAnalyticsDataClient({
  universe_domain: 'googleapis.com',
});
const express = require('express');
const validator = require('validator');
const apiV2Router = express.Router();

apiV2Router.post('/edit', asyncHandler(async function (req, res) {
  myLogger.info(`APIv2 received an Edit request: ${JSON.stringify(req.body)}`);
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
      res.send({
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
      res.status(403).send(`You don't have permission to edit ${process.env.OPEN_GOLINKS_SITE_HOST_AND_PORT}/${golink} which belongs to user:${links[0].author}.`);
    }
  }

}));

apiV2Router.get(`/available/:goLink(${GOLINK_PATTERN})`, asyncHandler(async (req,res)=> {
  let ret = await mongoose.connections[0].db.collection('shortlinks').find({linkname: req.params.goLink}).toArray();
  res.send(ret.length == 0);
}));

apiV2Router.get(`/link/:goLink(${GOLINK_PATTERN})`, asyncHandler(async (req,res)=> {
  let links;
  let goLink = req.params.goLink;
  if (req.query.nocache) {
    myLogger.info(`Forced nocache for ${goLink}`);
    links = await getLinksFromDBByLinknameAsync(goLink) as Array<object>;
  } else {
    links = await getLinksWithCache(goLink) as Array<object>;
  }
  if (links.length > 0) {
    let link = links[0];
    // TODO: migrate to use GoLinkProps
    res.send([{
      goLink: goLink,
      createdTime: link.createdTime,
      updatedTimed: link.updatedTimed,
      destHistory: link.destHistory,
      goDest: link.goDest,
      author: link.author,
      addLogo: link.addLogo,
      caption: link.caption,
      user: req.user,
      editable: isEditable(link['author'], req.user)
    }]);
  } else {
    res.send([]);
  }
}));
// GA4 不再需要这个认证了
// apiV2Router.get(`/gettoken`, asyncHandler(async (req, res) => {
//     return res.send(await getJWTClientAccessToekn())
//   })
// )
// apiV2Router.get(`/getviewId`, asyncHandler(async (req, res) => {
//   // https://ibb.co/xCJrNJ0
//   return res.send(process.env.GA_VIEW_ID)
// })
// )

apiV2Router.post(`/analyticsDataClientReport`, asyncHandler(async (req,res)=> {
  const params = req.body;
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${process.env.GA_VIEW_ID}`,
    ...params
  });
  return res.send(response);
}))

export default apiV2Router;

