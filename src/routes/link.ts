import {asyncHandler, isEditable, LINKNAME_PATTERN, myLogger} from "./utils";
import {getLinksFromDBByLinknameAsync, getLinksWithCache} from "../db";
const express = require('express');
const router = express.Router();

router.get(`/:golink(${LINKNAME_PATTERN})`, asyncHandler(async function (req, res) {
  if (req.visitor) {
    myLogger.debug(`req.visitor is set to `, req.visitor, 'now logging pageview to ', req.originalUrl, req.query.nocache);
  }

  let golink = req.params.golink;
  let links;
  if (req.query.nocache) {
    myLogger.info(`Forced nocache for ${golink}`);
    links = await getLinksFromDBByLinknameAsync(golink) as Array<object>;
  } else {
    links = await getLinksWithCache(golink) as Array<object>;
  }

  if (links.length) {
    let link = links[0] as any;
    myLogger.info('redirect to golink:', link.dest);

    res.render('redirect', {
      msg: `In 2 seconds, you are going to be directed to ${link.dest}`,
      msgType: 'success',
      oldDest: link.dest,
      golink: link.golink,
      author: link.author,
      addLogo: link.addLogo,
      caption: link.caption,
      user: req.user,
      editable: isEditable(link['author'], req.user)
    });

    let params = {
      ec: `Redirect`,
      ea: `Hit`,
      el: `Forward`,
      p: req.originalUrl,
      dest: link.dest,
      ev: 1,
    };
    req.visitor.event(params).send();
  } else {
    myLogger.info('Not found', 'LINK_' + req.params.golink);
    res.render('link-detail', {
      msg: "Create new link",
      title: "Create",
      golink: golink,
      oldDest: '',
      author: req.user ? req.user.emails[0].value : "anonymous",
      editable: true
    });

    let params = {
      ec: `Redirect`,
      ea: `Miss`,
      el: `ToEdit`,
      p: req.originalUrl,
      ev: 1,
    };
    req.visitor.event(params).send();
  }
}));

// router.get('/', asyncHandler(async function (req, res) {
//   res.redirect('/edit');
// }));

export default router;
