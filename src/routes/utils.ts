const NodeCache = require("node-cache");
import {getLogger} from 'log4js';

export const myLogger = (() => {
  let l = getLogger();
  l.level = 'debug';
  l.debug("Logger initiated...");
  return l;
})();

export const asyncHandler = fn => (req, res, next) =>
  Promise
    .resolve(fn(req, res, next))
    .catch(next);

export const myCache = new NodeCache();

export const isEditable = function (existingLinkAuthor, reqeustingUser) {
  myLogger.debug(`Author: ${existingLinkAuthor}`, 'user', reqeustingUser);
  if (existingLinkAuthor === 'anonymous'
    && process.env.ALLOW_OVERRIDE_ANONYMOUS === 'true'
    // We request a user to login before updating an anonymous link
    && reqeustingUser)
    return true;
  else if (reqeustingUser && reqeustingUser.emails.map(i => i.value).indexOf(existingLinkAuthor) >= 0) {
    return true;
  }
  return false;
};

export const getJWTClientAccessToekn = async function () {
  const {JWT} = require('google-auth-library');
  // An Base64 encoded version of Google Cloud Console service account json key private credentials
  let decoded = Buffer.from(process.env.GOOGLE_JSON_KEY, 'base64').toString();
  const keys = JSON.parse(decoded);
  const client = new JWT(
    keys.client_email,
    null,
    keys.private_key,
    [
      `https://www.googleapis.com/auth/analytics.readonly`
    ],
  );
  return new Promise((resolve, reject) => {
    client.authorize((err, result) => {
      if (err) {
        reject(err);
      } else
        resolve(result.access_token);

    });
  });
};
