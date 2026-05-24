import {
  InteractionContextType,
  ApplicationIntegrationType,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type User,
} from 'discord.js';
import configManager from '../config/config.js';
import { hasPermission, isModeratorOrAdmin } from '../utils/permissions.js';
import {
  getConfiguredGuild,
  resolveInvokingMember,
  checkBasePermissions,
  type Actor,
} from '../utils/moderation-actions.js';

type AnyCommandBuilder = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;

/**
 * Declare command availability explicitly per the modern Discord apps model:
 * guild-installed only (this is a self-hosted, single-server bot), invokable in
 * both guild channels and the bot's DMs. `Guild` is included on purpose so a
 * command used in a channel reaches `interactionCreate`, which answers it with
 * the mention response.
 */
export function withAppAvailability<T extends AnyCommandBuilder>(builder: T): T {
  builder.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM);
  builder.setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
  return builder;
}

/** Build an `Actor` descriptor for the human invoking a slash command. */
export function actorFromInteraction(interaction: ChatInputCommandInteraction): Actor {
  return { id: interaction.user.id, label: interaction.user.tag };
}

// ── Moderation command resolution ────────────────────────────────────────────

type GuildInvoker =
  | { ok: true; guild: Guild; invoker: GuildMember }
  | { ok: false; error: string };

/** Resolve the configured guild and the invoking user as a member of it. */
export async function resolveGuildInvoker(
  interaction: ChatInputCommandInteraction
): Promise<GuildInvoker> {
  const guild = getConfiguredGuild(interaction.client);
  if (!guild) {
    return { ok: false, error: '❌ Skonfigurowany serwer jest obecnie niedostępny.' };
  }
  const invoker = await resolveInvokingMember(guild, interaction.user.id);
  if (!invoker) {
    return {
      ok: false,
      error: '❌ Nie jesteś członkiem skonfigurowanego serwera.',
    };
  }
  return { ok: true, guild, invoker };
}

type ModerationContext =
  | {
      ok: true;
      guild: Guild;
      invoker: GuildMember;
      targetUser: User;
      targetMember: GuildMember;
    }
  | { ok: false; error: string };

/**
 * Resolve everything a member-targeting moderation command needs: the configured
 * guild, the invoking member, the `user` option resolved to a guild member, and
 * a passing permission + hierarchy check.
 */
export async function resolveModerationContext(
  interaction: ChatInputCommandInteraction,
  requiredPerm: bigint
): Promise<ModerationContext> {
  const base = await resolveGuildInvoker(interaction);
  if (!base.ok) return base;

  const targetUser = interaction.options.getUser('user', true);
  const targetMember = await base.guild.members
    .fetch(targetUser.id)
    .catch(() => null);
  if (!targetMember) {
    return { ok: false, error: '❌ Ten użytkownik nie jest członkiem serwera.' };
  }

  const permCheck = checkBasePermissions(base.invoker, targetMember, requiredPerm);
  if (permCheck) {
    return { ok: false, error: permCheck.content ?? '❌ Brak uprawnień.' };
  }

  return {
    ok: true,
    guild: base.guild,
    invoker: base.invoker,
    targetUser,
    targetMember,
  };
}

// ── DM utility/admin command access ──────────────────────────────────────────

export interface DmAccess {
  guild: Guild | null;
  member: GuildMember | null;
  /** May use AI-backed features (true when no AI roles are configured). */
  isAiAllowed: boolean;
  /** Holds Moderator/Administrator on the configured server. */
  isAdmin: boolean;
}

/** Resolve the invoking user's access level for DM utility/admin commands. */
export async function getDmAccess(
  interaction: ChatInputCommandInteraction
): Promise<DmAccess> {
  const guild = getConfiguredGuild(interaction.client);
  const member = guild
    ? await resolveInvokingMember(guild, interaction.user.id)
    : null;

  const allowedRoles = configManager.getAllowedRoles();
  const isAiAllowed =
    allowedRoles.length === 0
      ? true
      : member
        ? hasPermission(member, allowedRoles)
        : false;
  const isAdmin = member ? isModeratorOrAdmin(member) : false;

  return { guild, member, isAiAllowed, isAdmin };
}
