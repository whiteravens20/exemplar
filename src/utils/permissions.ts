import type { GuildMember } from 'discord.js';

const hasPermission = (member: GuildMember, allowedRoles: string[]): boolean => {
  if (!member) return false;

  for (const role of member.roles.cache.values()) {
    if (allowedRoles.includes(role.id)) {
      return true;
    }
  }
  return false;
};

const isModeratorOrAdmin = (member: GuildMember): boolean => {
  if (!member) return false;
  return (
    member.permissions.has('ModerateMembers') ||
    member.permissions.has('Administrator')
  );
};

export { hasPermission, isModeratorOrAdmin };
