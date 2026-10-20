import { Events, type Message, type PartialMessage } from 'discord.js';
import reactionRoles from '../utils/reaction-role-manager.js';
import type { BotEvent } from '../types/discord.js';

const event: BotEvent = {
  name: Events.MessageDelete,
  async execute(message: Message | PartialMessage) {
    // Bindings exist only on server messages.
    if (!message.guild) return;
    await reactionRoles.forgetMessages(message.guild, [message.id], 'messageDeleted');
  },
};

export default event;
