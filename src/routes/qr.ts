// The fake routes for faster frontend development
import {toDataURL} from 'qrcode';
import {asyncHandler} from "./utils";
import {GOLINK_PATTERN} from "../shared";

const Jimp = require('jimp');
const mongoose = require('mongoose');
const express = require('express');
const qrRouter = express.Router();
let composeQrCodePng = async function (qrDest, caption, addLogo) {
  let url = await toDataURL(
    qrDest,
    // @ts-ignore
    {width: 800, height: 800, margin: 1}
  );
  let qrJimp = await Jimp.read(Buffer.from(url.replace(/.+,/, ''), 'base64'));

  const theCanvas = await Jimp.read(1024, 1024, 0xffffffff);
  if (addLogo) {
    let logoJimp = await Jimp.read('./static/img/zgzg_logo_background_black.png');
    await logoJimp.resize(200, 200);
    await qrJimp.blit(logoJimp, 300, 300);
  }

  await theCanvas.blit(qrJimp, 112, 200);
  const font = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
  // prints 'Hello world!' on an image, middle and center-aligned
  await theCanvas.print(
    font,
    0,
    0,
    {
      text: caption, // TODO(xinbenlv): due to font issue, only english is allowed for now
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    },
    1024,
    224,
  );
  let outputBuff = await theCanvas.getBufferAsync(Jimp.MIME_PNG);
  return outputBuff;
};

if (process.env.DEBUG === '1') {
  qrRouter.get('/fake_qr.png', async /* TODO use asyncHanlder */(req, res) => {
    let outputBuff = await composeQrCodePng('http://zgzg.link/fake_qr', 'hello world', true);
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': outputBuff.length
    });
    res.end(outputBuff);
  });

  qrRouter.get('/d/fake_qr.png', async /* TODO use asyncHanlder */(req, res) => {
    let outputBuff = await composeQrCodePng('http://zgzg.link/fake_qr', 'hello world', true);
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
  let shortlinkItems = await mongoose.connections[0].db.collection('shortlinks').find({golink: req.params.golink}).toArray();
  let qrDeskUrl = `http://${req.app.locals.siteHost}/${req.params.golink}`;
  if (shortlinkItems.length == 0) {
    res.status(404);
    res.send(`Couldn't find ${qrDeskUrl}`);
  } else {
    let shortlinkItem = shortlinkItems[0];
    let outputBuff = await composeQrCodePng(
      qrDeskUrl,
      shortlinkItem.caption ? shortlinkItem.caption : qrDeskUrl,
      shortlinkItem.addLogo ? shortlinkItem.addLogo : false
    );

    let headers = {
      'Content-Type': 'image/png',
      'Content-Length': outputBuff.length
    };
    if (download) {
      headers['Content-disposition'] = 'attachment; filename=' + `${req.params.golink}.png`;
    }

    res.writeHead(200, headers);
    res.end(outputBuff);
  }
};

qrRouter.get(`/d/:golink(${GOLINK_PATTERN}).png`, asyncHandler(async (req, res) => {
  qrImageEndpoint(req, res, true);
}));

qrRouter.get(`/:golink(${GOLINK_PATTERN}).png`, asyncHandler(async (req, res) => {
  qrImageEndpoint(req, res, false);
}));

export default qrRouter;
