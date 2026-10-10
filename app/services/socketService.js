const usrLogic = require('../logics/usrLogic');
const rsClient = require('../clients/rsClient');
const {SOCKET_EVENTS} = require('./socketEvents');

/**
 * Wires up the socket server's event handlers.
 *
 * @param {import('socket.io').Server} io the socket.io server
 */
const execute = io => {
  // fires once per connected client; `socket` is that one client's connection
  io.on('connection', socket => {

    // the client just connected and wants the current map state
    socket.on(SOCKET_EVENTS.INIT, async () => {
      try {
        const rawTweets = await usrLogic.getTweets(); // fetch recent tweets from the DB
        const tweets = await enrichTweets(rawTweets); // add each author's profile
        socket.emit(SOCKET_EVENTS.INIT_RESOLVE, tweets); // reply to this client
      } catch (e) {
        console.error('[socket] initSocketState failed:', e);
        socket.emit(SOCKET_EVENTS.INIT_REJECT, e); // tell this client it failed
      }
    });

    // the client posted a new tweet
    socket.on(SOCKET_EVENTS.POST, async ({userId, geolocation, message}) => {
      try {
        const rawTweets = await usrLogic.postTweet({sub: userId, geolocation, message}); // persist, then re-read the list
        const tweets = await enrichTweets(rawTweets);
        socket.emit(SOCKET_EVENTS.POST_RESOLVE, tweets);           // update the poster
        socket.broadcast.emit(SOCKET_EVENTS.POST_RESOLVE, tweets); // push the new list to every other connected client
      } catch (e) {
        console.error('[socket] postTweet failed:', e);
        socket.emit(SOCKET_EVENTS.POST_REJECT, e);
      }
    });
  });
};

/**
 * Enriches tweets with profiles fetched from RS.
 *
 * @param {*} tweets
 * @return enriched tweets
 */
const enrichTweets = async (tweets) => {
  if (!tweets || tweets.length === 0) {
    return [];
  }

  const uniqueSubs = [...new Set(tweets.map(t => t.userId))].filter(Boolean);
  if (uniqueSubs.length === 0) {
    return tweets;
  }

  const profiles = await rsClient.fetchProfiles(uniqueSubs);
  if (!profiles || Object.keys(profiles).length === 0) {
    console.log('No profiles found, returning raw tweets.');
    return tweets;
  }

  const enrichedTweets = tweets.map(t => {
    const profile = profiles[t.userId];
    return {
      ...t,
      // a tweet's author may have no profile in the RS — guard against profile being undefined
      userName: profile?.name ?? 'Unknown',
    };
  });

  return enrichedTweets;
};

module.exports = {
  execute,
};
