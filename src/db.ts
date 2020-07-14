import {myCache, myLogger} from "./routes/utils";

const rp = require('request-promise');

const mongoose = require('mongoose');

export const getLinksWithCache = async (golink) => {
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

export const getLinksFromDBByLinknameAsync = async (golink) => {
  const collection = mongoose.connections[0].db.collection('shortlinks');
  let ret = await collection.aggregate([
    {
      $match: {linkname/*TODO change to goLink*/: golink}
    },
    {
      $project: {
        goLink: '$linkname',
        goDest: '$dest',
        linkname: true,
        dest: true,
        author: true,
        createdTime: true,
        updatedTime: true,
        addLogo: true,
        caption: true,
        destHistory: true,
      }
    }, {$limit: 1}
  ]).toArray();
  myLogger.debug(`getLinksFromDBByLinknameAsync golink = ${golink}, ret = ${JSON.stringify(ret, null, 2)}`);
  return ret == null ? [] : ret;

};

export const getLinksByEmailAsync = async function (emails) {
  const collection = mongoose.connections[0].db.collection('shortlinks');
  myLogger.debug(`emails ${JSON.stringify(emails, null, 2)}`);
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
  myLogger.debug(`getLinksByEmailAsync ret = ${JSON.stringify(t, null, 2)}`);
  return t;

};

export const getAllLinks = async function () {
  const collection = mongoose.connections[0].db.collection('shortlinks');
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


export const upsertLinkAsync = async function (golink, dest, author, addLogo, caption) {
  myLogger.debug(`Updating ${golink}`);
  myCache.del(golink);
  myLogger.debug(`Removed cahce for ${golink}`);

  const collection = mongoose.connections[0].db.collection('shortlinks');
  let now = new Date();
  return await collection.updateOne(
    {linkname: golink},
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
        destHistory: {dest: dest, timestamp: now}
      },
      $setOnInsert: {createdTime: now}
    },
    {upsert: true});

};
