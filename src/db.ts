import { getJWTClientAccessToekn, myCache, myLogger } from "./routes/utils";

const rp = require("request-promise");

const mongoose = require("mongoose");

export const getLinksWithCache = async golink => {
  let value = myCache.get(golink);
  if (value !== undefined) {
    myLogger.debug(`cache hit for ${golink}`);
    return value;
  } else {
    myLogger.debug(`cache missed for ${golink}`);
    // handle miss!
    let originalValue = getLinksFromDBByLinknameAsync(golink);
    myCache.set(golink, originalValue);
    myLogger.debug(`cache set for ${golink}`);
    return originalValue;
  }
};

export const getLinksFromDBByLinknameAsync = async golink => {
  const collection = mongoose.connections[0].db.collection("shortlinks");
  let ret = await collection
    .aggregate([
      {
        $match: { linkname /*TODO change to goLink*/: golink }
      },
      {
        $project: {
          goLink: "$linkname",
          goDest: "$dest",
          linkname: true,
          dest: true,
          author: true,
          createdTime: true,
          updatedTime: true,
          addLogo: true,
          caption: true,
          destHistory: true
        }
      },
      { $limit: 1 }
    ])
    .toArray();
  myLogger.debug(
    `getLinksFromDBByLinknameAsync golink = ${golink}, ret = ${JSON.stringify(
      ret,
      null,
      2
    )}`
  );
  return ret == null ? [] : ret;
};

export const getLinksByEmailAsync = async function(emails) {
  const collection = mongoose.connections[0].db.collection("shortlinks");
  myLogger.debug(`emails ${JSON.stringify(emails, null, 2)}`);
  let ret = await collection.find(
    { author: { $in: emails } },
    {
      projection: {
        linkname: true,
        dest: true,
        author: true,
        createdTime: true,
        updatedTime: true
      }
    }
  );
  let t = ret.toArray();
  myLogger.debug(`getLinksByEmailAsync ret = ${JSON.stringify(t, null, 2)}`);
  return t;
};

export const getAllLinks = async function(limit) {
  const collection = mongoose.connections[0].db.collection("shortlinks");
  return (
    await collection.find(
      {},
      {
        projection: {
          goLink: "$linkname",
          goDest: "$dest",
          linkname: true,
          dest: true,
          author: true,
          createdTime: true,
          updatedTime: true
        },
        limit: limit
      }
    )
  ).toArray();
};

export const upsertLinkAsync = async function(
  golink,
  dest,
  author,
  addLogo,
  caption
) {
  myLogger.debug(`Updating ${golink}`);
  myCache.del(golink);
  myLogger.debug(`Removed cahce for ${golink}`);

  const collection = mongoose.connections[0].db.collection("shortlinks");
  let now = new Date();
  return await collection.updateOne(
    { linkname: golink },
    {
      $set: {
        linkname: golink,
        dest: dest,
        author: author,
        addLogo: addLogo,
        caption: caption,
        updatedTimed: now
      },
      $push: {
        destHistory: { dest: dest, timestamp: now }
      },
      $setOnInsert: { createdTime: now }
    },
    { upsert: true }
  );
};

export const getLinksWithMetrics = async (links, dateRange, dimensions) => {
  if (links.length == 0) return links;
  let access_token = await getJWTClientAccessToekn();

  const baseUrlV4 = `https://analyticsreporting.googleapis.com/v4/reports:batchGet?`;
  let queryV4 = `{
   "reportRequests": [
    {
     "viewId": "${process.env.GA_VIEW_ID}",
     "dimensions": [
      {
       "name": "${dimensions}"
      }
     ],
     "metrics": [
      {
        "expression": "ga:pageviews"
      },
      {
        "expression": "ga:sessions"
      },
      {
        "expression": "ga:users"
      }
     ],
     "dimensionFilterClauses": [
      {
       "filters": [
        {
         "operator": "IN_LIST",
         "dimensionName": "ga:pagePathLevel1",
         "expressions": ${JSON.stringify(links.map(l => "/" + l["goLink"]))}
        }
       ]
      }
     ],
     "dateRanges": ${JSON.stringify(dateRange)}
    }
   ]
  }`;

  let optionV4 = {
    uri: baseUrlV4 + `access_token=${access_token}`,
    method: "POST",
    body: JSON.parse(queryV4),
    json: true
  };
  let retV4 = await rp(optionV4);

  let urlToPageviewMap = {};
  if (retV4["reports"][0]["data"]["rows"]) {
    retV4["reports"][0]["data"]["rows"].forEach(d => {
      let url = d["dimensions"][0];
      let pageViews = d["metrics"][0]["values"][0];
      let pageSessions = d["metrics"][0]["values"][1];
      let pageUsers = d["metrics"][0]["values"][2];
      let pageData = {};
      pageData["pageViews"] = pageViews;
      pageData["pageSessions"] = pageSessions;
      pageData["pageUsers"] = pageUsers;
      urlToPageviewMap[url] = pageData;
    });
  }

  if (dimensions != "ga:pagePath") {
    return urlToPageviewMap;
  }
  links.forEach(l => {
    l["pageData"] = urlToPageviewMap["/" + l["goLink"]];
  });
  return links;
};
