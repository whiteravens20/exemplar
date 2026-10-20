import { Events, type Role } from 'discord.js';
import reactionRoles from '../utils/reaction-role-manager.js';
import type { BotEvent } from '../types/discord.js';

const event: BotEvent = {
  name: Events.GuildRoleDelete,
  async execute(role: Role) {
    await reactionRoles.forgetRoles(role.guild, [role.id], 'roleDeleted');
  },
};

export default event;
