// The fake routes for faster frontend development
import { toDataURL} from 'qrcode';
const sharp = require('sharp');

var express = require('express');
var router = express.Router();
if (process.env.DEBUG === '1') {
    router.get('/fake_qr.png', async /* TODO use asyncHanlder */ (req, res) => {
        let url = await toDataURL(
      'http://zgzg.link/fake_qr',
          // @ts-ignore
         { width: 1024, height: 1024, margin: 1 }
      );
      let qrBuf = Buffer.from(url.replace(/.+,/, ''), 'base64');
      let logoBuf = await sharp('./static/img/zgzg_logo_background_black.png')
          .resize(256,256).png()
          .toBuffer();
      let img = await sharp(qrBuf)
          .resize(1024, 1024) // Assure it's a 1024
          .composite([{ input: logoBuf, gravity: "center"}])
          .sharpen()
          .withMetadata()
          .png()
          .toBuffer();
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length
      });
      res.end(img);
    });
}

router.get('/:url', (req, res) => {

});

module.exports = router;
