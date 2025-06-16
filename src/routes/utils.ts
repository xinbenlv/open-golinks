const NodeCache = require("node-cache");
import {getLogger} from 'log4js';
import * as fs from 'fs';

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

export function loadGcpCredentials() {
  try {
    const base64Credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!base64Credentials) {
      myLogger.error('GOOGLE_APPLICATION_CREDENTIALS_JSON env var not set.');
      return;
    }

    // 1. 从 Base64 解码回 JSON 凭据字符串
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const tempKeyPath = '/tmp/gcp-key.json';

    // 2. 写入到 Heroku 的 /tmp 临时文件
    fs.writeFileSync(tempKeyPath, credentials);

    // 3. 设置给 GCP SDK 识别的标准环境变量
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tempKeyPath;
    myLogger.info('Successfully loaded GCP credentials into /tmp/gcp-key.json');

  } catch (error) {
    myLogger.error('Failed to load GCP credentials:', error);
  }
}