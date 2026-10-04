const usrLogic = require('../logics/usrLogic');
const rsClient = require('../clients/rsClient');

/**
 * Executes socket connection i/o.
 *
 * @param {*} io
 */
const execute = io => {
  io.origins('*:*');

  io.on('connection', socket => {
    socket.on('initSocketState', async () => {
      try {
        const rawTweets = await usrLogic.getTweets();
        const tweets = await enrichTweets(rawTweets);
        socket.emit('initSocketState:resolve', tweets);
      } catch (e) {
        console.error('[socket] initSocketState failed:', e);
        socket.emit('initSocketState:reject', e);
      }
    });

    socket.on('postTweet', async ({userId, geolocation, message}) => {
      try {
        const rawTweets = await usrLogic.postTweet({sub: userId, geolocation, message});
        const tweets = await enrichTweets(rawTweets);
        socket.emit('postTweet:resolve', tweets);
        socket.broadcast.emit('postTweet:resolve', tweets);
      } catch (e) {
        console.error('[socket] postTweet failed:', e);
        socket.emit('postTweet:reject', e);
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
