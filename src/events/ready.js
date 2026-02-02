const { Events } = require('discord.js');
const logger = require('../utils/logger');
const { getRandomStatus } = require('../config/bot-statuses');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`✅ Bot logged in as ${client.user.tag}`);
    
    // Set bot status
    const status = getRandomStatus();
    client.user.setPresence({
      activities: [{
        name: status.name,
        type: status.type
      }],
      status: 'online'
    });

    // Rotate statuses every 30 seconds
    setInterval(() => {
      const newStatus = getRandomStatus();
      client.user.setActivity(newStatus.name, { type: newStatus.type });
    }, 30000);

    logger.info(`✅ Bot is ready! Serving ${client.guilds.cache.size} guild(s)`);
  }
};
