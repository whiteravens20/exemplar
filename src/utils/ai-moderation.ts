import {
  ChannelType,
  EmbedBuilder,
  type Message,
  type TextChannel,
} from 'discord.js';
import logger from './logger.js';
import configManager from '../config/config.js';
import N8NClient from './n8n-client.js';
import {
  applyDeleteMessage,
  applyTimeout,
  applyWarn,
  parseDuration,
  type Actor,
} from './moderation-actions.js';

/**
 * AI-driven automated moderation (issue #16).
 *
 * Bridges incoming guild messages to an n8n moderation workflow and dispatches
 * the resulting verdict through the existing `moderation-actions.*` action
 * layer. Designed to be the only file that knows the n8n verdict contract.
 *
 * Modes (env: AI_MODERATION_MODE):
 *   off     — disabled (default).
 *   shadow  — analyse messages but only log the verdict to MOD_LOG_CHANNEL_ID
 *             as a "🤖 [SHADOW]" embed. No DMs, no DB writes, no Discord
 *             actions. Use this to validate verdict quality before enforcing.
 *   enforce — dispatch actions for real via moderation-actions. Side effects
 *             are identical to a human moderator running the equivalent
 *             slash command — only the mod-log "Moderator" field differs.
 */

const ACTOR_LABEL = 'AI moderation';

export type ModerationAction = 'allow' | 'warn' | 'timeout' | 'delete';

export interface ModerationVerdict {
  action: ModerationAction;
  reason?: string;
  duration?: string;
}

let cachedClient: N8NClient | null = null;
let startupWarningLogged = false;

function getClient(): N8NClient | null {
  const { aiModerationUrl } = configManager.config.moderation;
  if (!aiModerationUrl) return null;
  if (!cachedClient) {
    cachedClient = new N8NClient(aiModerationUrl, configManager.config.n8n.apiKey);
  }
  return cachedClient;
}

export function isEnabled(): boolean {
  const { aiMode, aiModerationUrl } = configManager.config.moderation;
  if (aiMode === 'off') return false;
  if (!aiModerationUrl) {
    if (!startupWarningLogged) {
      logger.warn(
        'AI_MODERATION_MODE is "' +
          aiMode +
          '" but N8N_MODERATION_WORKFLOW_URL is unset — AI moderation stays disabled.'
      );
      startupWarningLogged = true;
    }
    return false;
  }
  return true;
}

export function shouldAnalyze(message: Message): boolean {
  if (message.author.bot || message.system) return false;
  if (message.channel.type !== ChannelType.GuildText) return false;
  if (!message.guild) return false;

  const { includeChannels, exemptRoles } = configManager.config.moderation;

  // Strict opt-in: empty allowlist means "analyse nothing". Operators must
  // list channels in AI_MOD_INCLUDE_CHANNELS to enrol them in moderation.
  // This keeps high-volume read-only channels (announcements, news) and any
  // unconfigured channel out of the n8n round-trip by default.
  if (includeChannels.length === 0) return false;
  if (!includeChannels.includes(message.channelId)) return false;

  if (exemptRoles.length > 0 && message.member) {
    const memberRoleIds = new Set(message.member.roles.cache.keys());
    if (exemptRoles.some((id) => memberRoleIds.has(id))) return false;
  }

  const content = (message.content || '').trim();
  if (content.length < 3) return false;

  return true;
}

export function validateVerdict(raw: unknown): ModerationVerdict | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const action = v.action;
  if (
    action !== 'allow' &&
    action !== 'warn' &&
    action !== 'timeout' &&
    action !== 'delete'
  ) {
    return null;
  }
  const verdict: ModerationVerdict = { action };
  if (typeof v.reason === 'string') verdict.reason = v.reason;
  if (typeof v.duration === 'string') verdict.duration = v.duration;
  if (action === 'timeout') {
    if (!verdict.duration || parseDuration(verdict.duration) === null) {
      return null;
    }
  }
  return verdict;
}

async function postShadowLog(
  message: Message,
  verdict: ModerationVerdict
): Promise<void> {
  const modLogChannelId = configManager.config.moderation.modLogChannelId;
  if (!modLogChannelId || !message.guild) return;

  const channel = message.guild.channels.cache.get(modLogChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const preview = buildPreview(message.content);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🤖 [SHADOW] ${verdict.action}`)
    .addFields(
      {
        name: 'Użytkownik',
        value: `${message.author.tag} (${message.author.id})`,
        inline: true,
      },
      { name: 'Kanał', value: `<#${message.channelId}>`, inline: true },
      { name: 'Powód', value: verdict.reason || '_(brak)_' }
    )
    .setTimestamp();

  if (verdict.action === 'timeout' && verdict.duration) {
    embed.addFields({ name: 'Czas', value: verdict.duration, inline: true });
  }
  embed.addFields({ name: 'Treść', value: preview });
  embed.setFooter({ text: 'Tryb shadow — żadna akcja nie została wykonana.' });

  try {
    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to post shadow-mode mod-log entry', {
      error: (error as Error).message,
      userId: message.author.id,
    });
  }
}

function buildPreview(content: string): string {
  const trimmed = (content || '').trim();
  if (!trimmed) return '_(pusta wiadomość)_';
  const truncated =
    trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
  return `\`\`\`\n${truncated.replace(/```/g, '` ` `')}\n\`\`\``;
}

async function enforce(
  message: Message,
  verdict: ModerationVerdict
): Promise<void> {
  const guild = message.guild;
  const botUser = message.client.user;
  if (!guild || !botUser) return;

  const actor: Actor = { id: botUser.id, label: ACTOR_LABEL };
  const reason = verdict.reason || 'Naruszenie wykryte przez moderację AI';

  switch (verdict.action) {
    case 'warn': {
      const result = await applyWarn(guild, message.author, reason, actor);
      if (!result.success) {
        logger.warn('AI moderation warn failed', {
          userId: message.author.id,
          detail: result.content,
        });
      }
      return;
    }
    case 'timeout': {
      // validateVerdict guarantees `duration` is set + parseable for timeouts.
      const duration = verdict.duration ?? '';
      const durationMs = parseDuration(duration);
      if (durationMs === null) return;
      const member = await guild.members
        .fetch(message.author.id)
        .catch(() => null);
      if (!member) {
        logger.warn('AI moderation timeout skipped — target not in guild', {
          userId: message.author.id,
        });
        return;
      }
      const result = await applyTimeout(member, durationMs, reason, actor);
      if (!result.success) {
        logger.warn('AI moderation timeout failed', {
          userId: message.author.id,
          detail: result.content,
        });
      }
      return;
    }
    case 'delete': {
      const result = await applyDeleteMessage(message, reason, actor);
      if (!result.success) {
        logger.warn('AI moderation delete failed', {
          messageId: message.id,
          detail: result.content,
        });
      }
      return;
    }
    case 'allow':
      // unreachable — filtered earlier
      return;
  }
}

export async function analyzeAndAct(message: Message): Promise<void> {
  if (!shouldAnalyze(message)) return;

  const client = getClient();
  if (!client) return;

  let result;
  try {
    result = await client.triggerWorkflow({
      platform: 'discord',
      mode: 'moderate',
      userId: message.author.id,
      userName: message.author.username,
      message: message.content,
      channelId: message.channelId,
      channelName:
        message.channel.type === ChannelType.GuildText
          ? message.channel.name
          : '',
      serverId: configManager.config.discord.serverId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('AI moderation: n8n request threw', {
      error: (error as Error).message,
      userId: message.author.id,
    });
    return;
  }

  if (!result.success) {
    logger.warn('AI moderation: n8n returned failure', {
      userId: message.author.id,
      status: result.status,
      error: result.error,
    });
    return;
  }

  const verdict = validateVerdict(
    (result.data as { verdict?: unknown } | undefined)?.verdict
  );
  if (!verdict) {
    logger.error('AI moderation: malformed verdict from n8n', {
      userId: message.author.id,
      data: JSON.stringify(result.data).slice(0, 300),
    });
    return;
  }

  if (verdict.action === 'allow') return;

  const mode = configManager.config.moderation.aiMode;
  if (mode === 'shadow') {
    await postShadowLog(message, verdict);
    return;
  }

  await enforce(message, verdict);
}
