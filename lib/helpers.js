import _ from 'lodash';
import Bot from './bot';
import { WebClient } from '@slack/client';
import { ConfigurationError } from './errors';

/**
 * Reads from the provided config file and returns an array of bots
 * @return {object[]}
 */
export function createBots(configFile) {
  const bots = [];

  // The config file can be both an array and an object
  if (Array.isArray(configFile)) {
    configFile.forEach(config => {
      const bot = new Bot(config);
      bot.connect();
      bots.push(bot);
    });
  } else if (_.isObject(configFile)) {
    // Make a single IRC bot that can send to Slack
    configFile.canSendToSlack = true;
    const bridgeBot = new Bot(configFile);
    bridgeBot.connect();
    bots.push(bridgeBot);

    // All other users should not post to Slack (no duplicates)
    configFile.canSendToSlack = false;

    var web = new WebClient(configFile.token);

    // Make an IRC bot for every user on Slack
    web.users.list({}, function(err, response) {
      if (err) return console.log('Error:', err);
      var i = 3;

      response.members.forEach(function(item) {
        // Don't make IRC bots for known bots that exist on Slack
        if (item.name != 'slackbot' && item.name != 'irc-bridge') {
          setTimeout(function() {
            configFile.nickname = item.name;
            configFile.slackUser = item.id;
            const userBot = new Bot(configFile);
            userBot.connect();
            bots.push(userBot);
            bridgeBot.ignoreFrom.push(userBot);
          }, i * 1000);

          // Delay between creating bots to prevent IRC/Slack spam
          i = i + 3;
        }
      });
    });

  } else {
    throw new ConfigurationError();
  }

  return bots;
}

/**
 * Returns occurances of a current channel member's name with `@${name}`
 * @return {string}
 */
export function highlightUsername(user, text) {
  const words = text.split(' ');
  const userRegExp = new RegExp(`^${user}[,.:!?]?$`);

  return words.map(word => {
    // if the user is already prefixed by @, don't replace
    if (word.indexOf(`@${user}`) === 0) {
      return word;
    }

    // username match (with some chars)
    if (userRegExp.test(word)) {
      return `@${word}`;
    }

    return word;
  }).join(' ');
}
