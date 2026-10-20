import { Events, type GuildMember, type PartialGuildMember } from 'discord.js';
import configManager from '../config/config.js';
import { findDeparture } from '../utils/member-departure.js';
import { logMemberLeave } from '../utils/admin-log.js';
import type { BotEvent } from '../types/discord.js';

const event: BotEvent = {
  name: Events.GuildMemberRemove,
  async execute(member: GuildMember | PartialGuildMember) {
    if (member.guild.id !== configManager.config.discord.serverId) return;
    const departure = await findDeparture(member.guild, member.id);
    if (departure.kind === 'byBot') return;
    await logMemberLeave(member.guild, member, departure);
  },
};

export default event;
