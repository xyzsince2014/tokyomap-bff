const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const redis = require('redis');
const RedisStore = require('connect-redis')(session);

const router = require('./routers/index');

const redisClient = redis.createClient({
  post: process.env.REDIS_PORT,
  host: process.env.REDIS_HOST
});
redisClient.on('error', (err) => console.error('[Redis Error] ', err));

const app = express();

// parse JSON everywhere EXCEPT inbound webhooks, whose routes need the raw body to verify the
// HMAC signature against the exact bytes the sender signed.
const jsonParser = express.json();

app
  .use(cookieParser())
  .use(express.urlencoded({extended: true}))
  .use((req, res, next) => (req.path.startsWith('/webhooks/') ? next() : jsonParser(req, res, next)))
  .use(
    session({
      key: process.env.SESSION_KEY,
      secret: process.env.SESSION_SECRET,
      proxy: true,
      resave: false,
      saveUninitialized: false,
      store: new RedisStore({client: redisClient}),
      cookie: {
        httpOnly: true,
        // todo: secure: process.env.NODE_ENV == 'production',
        secure: false,
        sameSite: "lax",
        // todo: sameSite: "strict",
        maxAge: 1000 * 60 * 30,
      }
    })
  )
  .use(
    cors({
      origin: process.env.DOMAIN,
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
      credentials: true
    })
  )
  .use("/", router());

// manage http headers
app
  .disable('x-powered-by')
  .set('etag', false);

module.exports = app;
