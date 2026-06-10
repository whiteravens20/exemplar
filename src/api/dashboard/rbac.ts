import { PermissionsBitField, type Client } from 'discord.js';
import configManager from '../../config/config.js';
import logger from '../../utils/logger.js';

/**
 * Dashboard authorization. The bot is already in-process and in the guild, so
 * authorization is decided from the bot's own view of the member — not from
 * OAuth scopes the user could tamper with. A user may view the dashboard if
 * they are the guild owner, hold Administrator/Manage Server, or hold one of the
 * configured allowed roles.
 */

export interface AccessResult {
  authorized: boolean;
  isAdmin: boolean;
}

export interface AccessInput {
  isOwner: boolean;
  hasAdmin: boolean;
  hasManageGuild: boolean;
  memberRoleIds: string[];
  allowedRoles: string[];
}

/** Pure RBAC decision — extracted so the matrix is unit-testable. */
export function evaluateAccess(input: AccessInput): AccessResult {
  const isAdmin = input.isOwner || input.hasAdmin || input.hasManageGuild;
  const allowed = new Set(input.allowedRoles);
  const hasAllowedRole = input.memberRoleIds.some((id) => allowed.has(id));
  return { authorized: isAdmin || hasAllowedRole, isAdmin };
}

const DENIED: AccessResult = { authorized: false, isAdmin: false };

/**
 * Resolve a user's live access against the configured guild. Returns DENIED if
 * the guild is unavailable or the user is not a current member (so leaving the
 * server revokes access on the next check).
 */
export async function resolveAccess(
  client: Client,
  userId: string
): Promise<AccessResult> {
  const serverId = configManager.config.discord.serverId;
  const guild = client.guilds.cache.get(serverId);
  if (!guild) return DENIED;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return DENIED;

  try {
    return evaluateAccess({
      isOwner: guild.ownerId === userId,
      hasAdmin: member.permissions.has(PermissionsBitField.Flags.Administrator),
      hasManageGuild: member.permissions.has(
        PermissionsBitField.Flags.ManageGuild
      ),
      memberRoleIds: [...member.roles.cache.keys()],
      allowedRoles: configManager.config.dashboard.allowedRoles,
    });
  } catch (error) {
    logger.error('Dashboard access resolution failed', {
      error: (error as Error).message,
      userId,
    });
    return DENIED;
  }
}
