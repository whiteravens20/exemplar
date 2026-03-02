import { Events, type Client } from 'discord.js';
import logger from '../utils/logger.js';
import { getRandomStatus } from '../config/bot-statuses.js';
import type { BotEvent } from '../types/discord.js';

const event: BotEvent = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    if (!client.user) {
      logger.error('Client user not available on ready event');
      return;
    }
    logger.info(`✅ Bot logged in as ${client.user.tag}`);

    const status = getRandomStatus();
    client.user.setPresence({
      activities: [
        {
          name: status.name,
          type: status.type,
        },
      ],
      status: 'online',
    });

    logger.info(`🎭 Set initial status: ${status.name}`);

    setInterval(() => {
      const newStatus = getRandomStatus();
      client.user?.setActivity(newStatus.name, { type: newStatus.type });
      logger.info(`🎭 Rotated status: ${newStatus.name}`);
    }, 30000);

    logger.info(
      `✅ Bot is ready! Serving ${client.guilds.cache.size} guild(s)`
    );
  },
};

export default event;
