// The fake routes for faster frontend development
import {toDataURL} from 'qrcode';
import {asyncHandler} from "./utils";
import {GOLINK_PATTERN} from "../shared";
import {loadImage} from 'canvas';

const Jimp = require('jimp');
const mongoose = require('mongoose');
const express = require('express');
const qrRouter = express.Router();
let addLineBreak = function(caption) {
  let breakSize = 40;
  if (caption.length > breakSize) {
    let charArray = caption.split('');
    let cursor = 0;
    let afterAppend = [];
    while(cursor<=charArray.length) {
      let piece = charArray.slice(cursor, cursor + breakSize);
      afterAppend = afterAppend.concat(piece);
      afterAppend.push('\n');
      cursor += breakSize;
    }
    return afterAppend.join('');
  }
  return caption;
}
let composeQrCodePng2 = async function(qrDest, caption, addLogo) {
  const { createCanvas, registerFont } = require('canvas')
  registerFont( './static/fonts/NotoSansCJKsc-Regular.otf', { family: "Noto Sans CJK SC Regular" } );
  const canvas = createCanvas(1000, 1300)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0,0, 1000, 1300);

  let textContent = addLineBreak(caption) || 'Hi, 世界!';
  ctx.fillStyle = "#000000";
  ctx.font = `40px 'Noto Sans CJK SC Regular'`
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(textContent, 500, 200);

  var QRCode = require('qrcode')
  let qrCanvas = createCanvas(800, 800);
  await QRCode.toCanvas(qrCanvas, qrDest, {width: 800, margin: 0, errorCorrectionLevel: 'H'});
  ctx.drawImage(qrCanvas, 100,400, 800,800);

  if (addLogo) {
    const logo = await loadImage('./static/img/zgzg-round-logo.png');
    ctx.drawImage(logo, 400, 700, 200, 200);
  }

  ctx.fillStyle = "#000000";
  ctx.font = '40px Impact'
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText('Open-GoLinks', 500, 1250);

  /** https://textik.com/#c262bef361462975

   1000x1300
   (0,0)                             (10h,0)
   +----------------------------------------+
   |                                        |
   |       | 100                            |
   |(1h,1h)         800x200       (9h,1h)   |
   |      +--------------------------+      |
   |      |                          |      |
   | ---  |                          | ---  |
   | 100  |                          | 100  |                                                    +
   |      |                          |      |
   |      |                          |      |
   | 1h,3h+--------------------------+9h,3h |
   |                                        |
   |                                        |
   |       -                                |
   |       | 100                            |
   |       -       800 x 800                |
   |1h,4h +--------------------------+9h,4h |
   |      |                          |      |
   |      |         | 300 |          |      |
   |      |                          |      |
   |      |       4h,7h  6h,7h       |      |
   |      |       +----------+       |      |
   |      |  ---  |          |  ---  |      |
   |      |  300  |  Logo    |  300  |      |
   |      |  ---  |200 x 200 |  ---  |      |
   |      |       |          |       |      |
   |      |       +----------+       |      |
   |      |                          |      |
   |      |         | 300 |          |      |
   |      |                          |      |
   |1h,12h+--------------------------+9h,12h|
   |                                        |
   |       |100                             |
   |                                        |
   +----------------------------------------+
   0h,13h                            10h,13h


   */

  let qrJimp = await Jimp.read(Buffer.from(canvas.toDataURL().replace(/.+,/, ''), 'base64'));
  return qrJimp.getBufferAsync(Jimp.MIME_PNG);
}

if (process.env.DEBUG === '1') {
  qrRouter.get('/fake_qr.png', async /* TODO use asyncHanlder */(req, res) => {
    let outputBuff = await composeQrCodePng2(`${process.env.OPEN_GOLINKS_SITE_PROTOCOL}://${process.env.OPEN_GOLINKS_SITE_HOST_AND_PORT}/fake_qr`, 'hello world', true);
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': outputBuff.length
    });
    res.end(outputBuff);
  });

  qrRouter.get('/d/fake_qr.png', async /* TODO use asyncHanlder */(req, res) => {
    let outputBuff = await composeQrCodePng2(`${process.env.OPEN_GOLINKS_SITE_PROTOCOL}://${process.env.OPEN_GOLINKS_SITE_HOST_AND_PORT}/fake_qr`, 'hello world', true);
    res.set();
    res.writeHead(200, {
      'Content-disposition': 'attachment; filename=' + `fake_qr_downloaded.png`,
      'Content-Type': 'image/png',
      'Content-Length': outputBuff.length
    });
    res.end(outputBuff);
  });
}

let qrImageEndpoint = async (req, res, download) => {
  let goLinkItems = await mongoose.connections[0].db.collection('shortlinks').find({linkname: req.params.golink}).toArray();
  let qrBaseUrl = `http://${req.app.locals.siteHost}/${req.params.golink}`;
  if (goLinkItems.length == 0) {
    goLinkItems = [{}];
  }
  let goLinkItem = goLinkItems[0];
  let addLogo = req.query?.addLogo === 'true';
  let caption = req.query?.caption || goLinkItem.caption || qrBaseUrl;
  let outputBuff = await composeQrCodePng2(qrBaseUrl, caption, addLogo);

  let headers = {
    'Content-Type': 'image/png',
    'Content-Length': outputBuff.length
  };
  if (download) {
    headers['Content-disposition'] = 'attachment; filename=' + `${req.params.golink}.png`;
  }

  res.writeHead(200, headers);
  res.end(outputBuff);

};

/**
 * Endpoint for downloading QR code
 */
qrRouter.get(`/d/:golink(${GOLINK_PATTERN}).png`, asyncHandler(async (req, res) => {
  qrImageEndpoint(req, res, true);
}));

/**
 * Endpoint for fetching QR code
 */
qrRouter.get(`/:golink(${GOLINK_PATTERN}).png`, asyncHandler(async (req, res) => {
  qrImageEndpoint(req, res, false);
}));

export default qrRouter;
