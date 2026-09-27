import {
  Events,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from 'discord.js';
import reactionRoles from '../utils/reaction-role-manager.js';
import type { BotEvent } from '../types/discord.js';

const event: BotEvent = {
  name: Events.MessageReactionAdd,
  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ) {
    await reactionRoles.handleReaction(reaction, user, 'add');
  },
};

export default event;
