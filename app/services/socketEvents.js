/**
 * Socket event names.
 */
const SOCKET_EVENTS = {
  INIT: 'initSocketState',
  INIT_RESOLVE: 'initSocketState:resolve',
  INIT_REJECT: 'initSocketState:reject',
  POST: 'postTweet',
  POST_RESOLVE: 'postTweet:resolve',
  POST_REJECT: 'postTweet:reject',
};

module.exports = { SOCKET_EVENTS };
