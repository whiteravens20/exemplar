const logger = require('./logger');

const parseRoleIds = (roleString) => {
  if (!roleString) return [];
  return roleString.split(',').map(id => id.trim());
};

const hasPermission = (member, allowedRoles) => {
  if (!member) return false;
  
  for (const role of member.roles.cache.values()) {
    if (allowedRoles.includes(role.id)) {
      return true;
    }
  }
  return false;
};

const isModeratorOrAdmin = (member) => {
  if (!member) return false;
  return member.permissions.has('ModerateMembers') || 
         member.permissions.has('Administrator');
};

module.exports = {
  parseRoleIds,
  hasPermission,
  isModeratorOrAdmin
};
