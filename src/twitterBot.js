const axios = require("axios");
const crypto = require("crypto");
const OAuth = require("oauth-1.0a");

class TwitterBot {
  constructor(settings, auth) {
    this.keyword = settings.keyword;
    this.minRTs = settings.minRTs;
    this.minFavs = settings.minFavs;
    this.lang = settings.lang;
    this.tweetFilters = settings.tweetFilters;
    this.usernameFilters = settings.usernameFilters;
    this.replyText = settings.replyText;

    this.oauth_consumer_key = auth.api_key;
    this.oauth_consumer_secret = auth.api_secret;
    this.oauth_token = auth.access_token;
    this.oauth_token_secret = auth.access_token_secret;

    this.currentDate = new Date();
    this.countRepliesAndRTs = 0;
  }

  async requestApi(request_data) {
    try {
      const oauth = OAuth({
        consumer: {
          key: this.oauth_consumer_key,
          secret: this.oauth_consumer_secret,
        },
        signature_method: "HMAC-SHA1",
        hash_function(base_string, key) {
          return crypto
            .createHmac("sha1", key)
            .update(base_string)
            .digest("base64");
        },
      });

      const token = {
        key: this.oauth_token,
        secret: this.oauth_token_secret,
      };

      const response = await axios({
        method: request_data.method,
        url: request_data.url,
        data: request_data.data,
        headers: oauth.toHeader(oauth.authorize(request_data, token)),
      });
      return response;
    } catch (err) {
      err.response.data.code !== 261 &&
        console.log("requestApi error", err.response.data);
      return err.response;
    }
  }

  async getTweet(id) {
    try {
      const request_data = {
        url: `https://api.twitter.com/1.1/statuses/show/${id}`,
        method: "GET",
      };

      const response = await this.requestApi(request_data);

      return response;
    } catch (err) {
      console.log("getTweet error");
      return err.response;
    }
  }

  async reply(id, username) {
    try {
      const status = `@${username} ${this.replyText}`;
      const encoded_status = encodeURIComponent(status).replace("!", "%21");

      const request_data = {
        url: `https://api.twitter.com/1.1/statuses/update.json?status=${encoded_status}&in_reply_to_status_id=${id}`,
        method: "POST",
      };

      await this.requestApi(request_data);

      this.countRepliesAndRTs += 1;

      console.log(`Actual count: ${this.countRepliesAndRTs} Replies and RTs`);
      return true;
    } catch (err) {
      console.log("reply error");
      return false;
    }
  }

  async retweet(id) {
    try {
      const request_data = {
        url: `https://api.twitter.com/1.1/statuses/retweet/${id}`,
        method: "POST",
      };

      const response = await this.requestApi(request_data);

      this.countRepliesAndRTs += 1;

      console.log(`Actual count: ${this.countRepliesAndRTs} Replies and RTs`);
      return response.data.retweeted;
    } catch (err) {
      console.log("retweet error");
      return false;
    }
  }

  async favorite(id) {
    try {
      const request_data = {
        url: `https://api.twitter.com/1.1/favorites/create.json?id=${id}`,
        method: "POST",
      };

      const response = await this.requestApi(request_data);

      return response.data.favorited;
    } catch (err) {
      console.log("favorite error");
      return false;
    }
  }

  async searchTweets() {
    try {
      console.log("Searching for threads...");

      const { keyword, minRTs, minFavs, lang } = this;

      const count = 100;

      const request_data = {
        url: `https://api.twitter.com/1.1/search/tweets.json?q=${keyword}%20min_faves%3A${minFavs}%20min_retweets%3A${minRTs}%20lang%3A${lang}&count=${count}`,
        method: "GET",
      };

      const response = await this.requestApi(request_data);
      const { statuses } = response.data;

      const pastMinutes = (new Date() - this.currentDate) / (1000 * 60);
      if (pastMinutes >= 180) {
        this.currentDate = new Date();
        this.countRepliesAndRTs = 0;
        console.log(`Past ${pastMinutes}mins, reseting countRepliesAndRTs`);
      }

      statuses.map(async (tweet) => {
        const { id_str, text } = tweet;

        const res = await this.getTweet(id_str);
        const { retweeted, favorited } = res.data;
        const { screen_name } = res.data.user;

        let blocked = false;
        let blockReason = "";

        this.usernameFilters.map((filter) => {
          const regex = new RegExp(filter, "gi");
          blocked = screen_name.match(regex);
          blocked && (blockReason = filter);
        });

        this.tweetFilters.map((filter) => {
          const regex = new RegExp(filter, "gi");
          blocked = text.match(regex);
          blocked && (blockReason = filter);
        });

        if (!blocked) {
          if (!favorited) {
            const FAVres = await this.favorite(id_str);
            FAVres && console.log("Faved:", id_str);
          }

          if (!retweeted && this.countRepliesAndRTs < 300) {
            const RTres = await this.retweet(id_str);
            RTres && console.log("Retweeted:", id_str);
          }
        } else {
          console.log(`Blocked @${screen_name}:`, blockReason);
        }
      });
    } catch (err) {
      console.log("searchTweets error", err);
    }
  }
}

module.exports = TwitterBot;
