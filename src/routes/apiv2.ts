import { GOLINK_PATTERN } from "../shared";
import {
  asyncHandler,
  isEditable,
  myLogger,
  getJWTClientAccessToekn
} from "./utils";
import {
  getLinksFromDBByLinknameAsync,
  getLinksWithCache,
  getAllLinks,
  getLinksWithMetrics
} from "../db";
import * as mongoose from "mongoose";
const express = require("express");
const apiV2Router = express.Router();

apiV2Router.get(
  `/available/:goLink(${GOLINK_PATTERN})`,
  asyncHandler(async (req, res) => {
    let ret = await mongoose.connections[0].db
      .collection("shortlinks")
      .find({ linkname: req.params.goLink })
      .toArray();
    res.send(ret.length == 0);
  })
);

apiV2Router.get(
  `/gettoken`,
  asyncHandler(async (req, res) => {
    return res.send(await getJWTClientAccessToekn());
  })
);
apiV2Router.get(
  `/getviewId`,
  asyncHandler(async (req, res) => {
    return res.send(process.env.GA_VIEW_ID);
  })
);

apiV2Router.get(
  `/link/:goLink(${GOLINK_PATTERN})`,
  asyncHandler(async (req, res) => {
    let links;
    let goLink = req.params.goLink;
    if (req.query.nocache) {
      myLogger.info(`Forced nocache for ${goLink}`);
      links = (await getLinksFromDBByLinknameAsync(goLink)) as Array<object>;
    } else {
      links = (await getLinksWithCache(goLink)) as Array<object>;
    }
    if (links.length > 0) {
      let link = links[0];
      // TODO: migrate to use GoLinkProps
      res.send([
        {
          goLink: goLink,
          createdTime: link.createdTime,
          updatedTimed: link.updatedTimed,
          destHistory: link.destHistory,
          goDest: link.goDest,
          author: link.author,
          addLogo: link.addLogo,
          caption: link.caption,
          user: req.user,
          editable: isEditable(link["author"], req.user)
        }
      ]);
    } else {
      res.send([]);
    }
  })
);

/* For dashboard2.vue */
apiV2Router.get(
  `/get`,
  asyncHandler(async (req, res) => {
    let links = [];
    let goLinks;
    let limit = parseInt(req.query.limit);
    let dateRange = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    let dimensions = req.query.dimensions;
    // links = (await getAllLinks(limit)) as Array<object>;
    (await getAllLinks(limit)).forEach(l => {
      l = {
        goLink: l.linkname,
        createdTime: l.createdTime,
        updatedTimed: l.updatedTimed,
        destHistory: l.destHistory,
        goDest: l.dest,
        author: l.author,
        addLogo: l.addLogo,
        caption: l.caption,
        user: req.user,
        editable: isEditable(l["author"], req.user)
      };
      links.push(l);
    });
    goLinks = (await getLinksWithMetrics(
      links,
      dateRange,
      dimensions
    )) as Array<object>;
    res.send(goLinks);
  })
);

apiV2Router.get(
  `/get/:goLink(${GOLINK_PATTERN})`,
  asyncHandler(async (req, res) => {
    let links;
    let goLink = req.params.goLink;

    let dateRange = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    let dimensions = req.query.dimensions;

    if (req.query.nocache) {
      myLogger.info(`Forced nocache for ${goLink}`);
      links = (await getLinksFromDBByLinknameAsync(goLink)) as Array<object>;
    } else {
      links = (await getLinksWithCache(goLink)) as Array<object>;
    }
    if (links.length > 0) {
      // let link = links[0];
      // TODO: migrate to use GoLinkProps
      let link = [
        {
          goLink: goLink,
          createdTime: links[0].createdTime,
          updatedTimed: links[0].updatedTimed,
          destHistory: links[0].destHistory,
          goDest: links[0].goDest,
          author: links[0].author,
          addLogo: links[0].addLogo,
          caption: links[0].caption,
          user: req.user,
          editable: isEditable(links[0]["author"], req.user)
        }
      ];
      res.send(
        (await getLinksWithMetrics(link, dateRange, dimensions)) as Array<
          object
        >
      );
    } else {
      res.send([]);
    }
  })
);

export default apiV2Router;
