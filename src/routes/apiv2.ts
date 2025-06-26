import {GOLINK_PATTERN} from "../shared";
import {asyncHandler, isEditable, myLogger} from "./utils";
import {getLinksFromDBByLinknameAsync, getLinksWithCache, upsertLinkAsync} from "../db";
import * as mongoose from 'mongoose';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
const express = require('express');
const validator = require('validator');
const apiV2Router = express.Router();

// 因为凭据已在应用启动时加载，这里可以直接初始化
const analyticsDataClient = new BetaAnalyticsDataClient();
const propertyId = process.env.GA4_PROPERTY_ID;
console.log('[apiv2.ts] [debug] ==> propertyId', propertyId);
apiV2Router.post('/ga4/reports', asyncHandler(async function (req, res) {
  if (!propertyId) {
    return res.status(500).send('GA4_PROPERTY_ID not configured on server.');
  }

  try {
    // 透传所有前端参数，只补充 property 字段
    const reportRequest = {
      property: `properties/${propertyId}`,
      ...req.body
    };
    console.log('[DBG][apiv2] Final reportRequest:', JSON.stringify(reportRequest));
    myLogger.info('[DBG][apiv2] GA4 API request:', JSON.stringify(reportRequest));
    const [response] = await analyticsDataClient.runReport(reportRequest);
    console.log('[DBG][apiv2] GA4 API response:', JSON.stringify(response));
    res.send(response);
  } catch (error) {
    myLogger.error('[DBG][apiv2] GA4 Data API request failed:', error);
    res.status(500).send({ 
      error: 'Failed to fetch GA4 data.',
      details: error.message 
    });
  }
}));

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
      req.visitor?.event(params)?.send();
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

apiV2Router.get('/my-links', asyncHandler(async (req, res) => {
  if (!req.user || !req.user.emails || !req.user.emails[0] || !req.user.emails[0].value) {
    return res.status(401).send({ error: 'Unauthorized' });
  }
  const userEmail = req.user.emails[0].value;
  // 查询所有 author 为 userEmail 的链接
  const links = await mongoose.connections[0].db.collection('shortlinks').find({ author: userEmail }).toArray();
  res.send(links);
}));

export default apiV2Router;

