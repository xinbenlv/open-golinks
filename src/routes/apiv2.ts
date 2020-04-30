import {GOLINK_PATTERN} from "../shared";
import {asyncHandler, isEditable, myLogger} from "./utils";
import {getLinksFromDBByLinknameAsync, getLinksWithCache} from "../db";
import * as mongoose from 'mongoose';
const express = require('express');
const apiV2Router = express.Router();

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

export default apiV2Router;

