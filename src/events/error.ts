import { Events } from 'discord.js';
import logger from '../utils/logger.js';
import type { BotEvent } from '../types/discord.js';

const event: BotEvent = {
  name: Events.Error,
  execute(error: unknown) {
    const err = error as Error;
    logger.error('Discord client error', {
      error: err.message,
      stack: err.stack,
    });
  },
};

export default event;
