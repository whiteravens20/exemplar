const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.Error,
  execute(error) {
    logger.error('Discord client error', {
      error: error.message,
      stack: error.stack
    });
  }
};
