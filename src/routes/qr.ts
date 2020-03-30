// The fake routes for faster frontend development
import { toDataURL} from 'qrcode';
const Jimp = require('jimp');

var express = require('express');
var router = express.Router();
let createQrCodeImage = async function (qrDest, caption) {
    let url = await toDataURL(
        qrDest,
        // @ts-ignore
        { width: 800, height: 800, margin: 1 }
    );
    let qrJimp = await Jimp.read(Buffer.from(url.replace(/.+,/, ''), 'base64'));
    let logoJimp = await Jimp.read('./static/img/zgzg_logo_background_black.png');
    await logoJimp.resize(200,200);
    await qrJimp.blit(logoJimp, 300, 300);

    const theCanvas = await Jimp.read(1024, 1024, 0xffffffff);
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
    router.get('/fake_qr.png', async /* TODO use asyncHanlder */ (req, res) => {
      let outputBuff = await createQrCodeImage('http://zgzg.link/fake_qr', 'hello world');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': outputBuff.length
      });
      res.end(outputBuff);
    });

    router.get('/d/fake_qr.png', async /* TODO use asyncHanlder */ (req, res) => {
        let outputBuff = await createQrCodeImage('http://zgzg.link/fake_qr', 'hello world');
        res.set();
        res.writeHead(200, {
            'Content-disposition': 'attachment; filename=' + `fake_qr_downloaded.png`,
            'Content-Type': 'image/png',
            'Content-Length': outputBuff.length
        });
        res.end(outputBuff);
    });
}

router.get('/:url', (req, res) => {

});

module.exports = router;
