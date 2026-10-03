import { Events, type Message, type PartialMessage } from 'discord.js';
import reactionRoles from '../utils/reaction-role-manager.js';
import type { BotEvent } from '../types/discord.js';

const event: BotEvent = {
  name: Events.MessageDelete,
  async execute(message: Message | PartialMessage) {
    await reactionRoles.forgetMessages([message.id], 'message deleted');
  },
};

export default event;
