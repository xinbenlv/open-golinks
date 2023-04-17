This is a Go-Link service built on top with `NodeJS`, `HTML5/CSS/Bootstrap`.

## Development
1. Install the right `nodejs` version (and right python version e.g. python3.10) and do `npm install`
2. Run the following

```sh
npm run build
npm run dev
```
## Deploy your own instance

1. Create and config your MongoDB instance. We recommend using [mLab](https://mlab.com/) from Heroku Credentials
2. Create your Google Analytics instance, take down Tracking ID
3. Create your Auth0 account and take down the client id, client secret, domain and callback url.
4. Create `.env` file. You can use [heroku-dotenv](https://www.npmjs.com/package/heroku-dotenv) to push to your heroku instance if you are deploying on Heroku.

## Security Rules
1. A goLink could be created *without* login.
2. A goLink could only be updated **with** login.

## Contributions
We welcome contributions. Send us Pull Request.

