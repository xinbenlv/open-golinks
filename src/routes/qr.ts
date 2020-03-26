// The fake routes for faster frontend development
import { toDataURL} from 'qrcode';

var express = require('express');
var router = express.Router();
if (process.env.DEBUG === '1') {
    router.get('/fake_qr.png', async /* TODO use asyncHanlder */ (req, res) => {
      let url = await toDataURL(
        'http://zgzg.link/fake_qr',
      );
      let img = Buffer.from(url.replace(/.+,/, ''), 'base64');
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