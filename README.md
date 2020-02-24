This is a Go-Link service built on top with `NodeJS`, `HTML5/CSS/Bootstrap`


## Deploy your own instance

[![Greenkeeper badge](https://badges.greenkeeper.io/xinbenlv/open-golinks.svg)](https://greenkeeper.io/)

1. Create and config your MongoDB instance. We recommend using [mLab](https://mlab.com/) from Heroku Credentials
2. Create your Google Analytics instance, take down Tracking ID
3. Create your Auth0 account and take down the client id, client secret, domain and callback url.
4. Create `.env` file. You can use [heroku-dotenv](https://www.npmjs.com/package/heroku-dotenv) to push to your heroku instance if you are deploying on Heroku.


## Contributions
We welcome contributions. Send us Pull Request.

## TODO / Wishlist

### Features
 - [ ] Ability to delete link
 - [ ] Show stats direcly along with links (from Google Analytics)
 - [ ] One Button Deploy to Heroku. -  Will make this repository extremely useful.
 
### Productionization
 - [X] Cache Mechanism
 - [ ] DDoS Prevention (reCAPTCHA)?
