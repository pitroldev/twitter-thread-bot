const TwitterBot = require("./twitterBot");

const config = require("../config.json");

const ThreadBot = new TwitterBot(config.settings, config.auth);

ThreadBot.searchTweets();

if (!process.env.NODE_ENV) {
  setInterval(ThreadBot.searchTweets, config.settings.intervalMin * 60 * 1000);
}
