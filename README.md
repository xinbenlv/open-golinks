This is a Go-Link service built on top with `NodeJS`, `HTML5/CSS/Bootstrap`


## Deploy your own instance
1. Create and config your MySQL instance. We recommend using ClearDB. You will need it for the MySQL credentials
2. Create your Google Analytics instance, take down Tracking ID
3. Create your Auth0 account and take down the client id, client secret, domain and callback url.
4. Create `.env` file. You can use [heroku-dotenv](https://www.npmjs.com/package/heroku-dotenv) to push to your heroku instance if you are deploying on Heroku.

Due to the auto-keep alive, the instance will keep be wakenup every 60(default livetime for connection clsure) seconds for now. We are going to decouple them as much as possible

## Contributions
We welcome contributions. Send us Pull Request.


## TODO

### Feature
 - [ ] Able to delete link
 - [ ] Stats
 
### Productionization
 - [ ] Cache Mechanism
 - [ ] DDoS Prevention (reCAPTCHA)?