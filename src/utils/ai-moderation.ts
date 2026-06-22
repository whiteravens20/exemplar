import {
  ChannelType,
  EmbedBuilder,
  type Message,
  type TextChannel,
} from 'discord.js';
import logger from './logger.js';
import configManager from '../config/config.js';
import N8NClient from './n8n-client.js';
import warningRepo from '../db/repositories/warning-repository.js';
import moderationLogRepo from '../db/repositories/moderation-log-repository.js';
import {
  applyDeleteMessage,
  applyTimeout,
  applyWarn,
  parseDuration,
  type Actor,
} from './moderation-actions.js';
import type { ModerationSeverity } from '../types/database.js';

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
const RECENT_WARNINGS_LIMIT = 5;
// Upper bound on message length forwarded to n8n. Discord's own 2 000-char
// guild limit keeps real messages well under this, so the cap is a defensive
// guard (and self-documenting intent) against any future path that bypasses
// Discord's limit — not a constraint operators are expected to hit.
const MAX_CONTENT_LENGTH = 4000;
// Cap the in-memory cooldown map so a long-running bot in a noisy guild can't
// leak unbounded entries. Eviction policy is "drop oldest"; entries older than
// the configured cooldown are also evicted lazily on each check.
const COOLDOWN_MAX_ENTRIES = 10_000;

export type ModerationAction = 'allow' | 'warn' | 'timeout' | 'delete';

export interface ModerationVerdict {
  action: ModerationAction;
  reason?: string;
  duration?: string;
  /**
   * Optional rule the verdict was attributed to, surfaced to the dashboard as
   * the "triggered rule". The n8n workflow may include it; when absent the
   * dashboard simply shows the reasoning without a rule.
   */
  rule?: string;
}

let cachedClient: N8NClient | null = null;
let startupWarningLogged = false;
const lastAnalysisAt = new Map<string, number>();

/**
 * Per-user cooldown gate. Prevents a single user from triggering unbounded
 * concurrent n8n calls during a burst of messages in an enrolled channel.
 * Returns true when this call is allowed (and records the timestamp); false
 * when the user is still within their cooldown window. Cooldown of 0 disables
 * the gate.
 *
 * Exported for tests.
 */
export function checkCooldown(userId: string, now: number = Date.now()): boolean {
  const cooldownMs = configManager.config.moderation.userCooldownMs;
  if (cooldownMs <= 0) return true;

  const last = lastAnalysisAt.get(userId);
  if (last !== undefined && now - last < cooldownMs) return false;

  if (lastAnalysisAt.size >= COOLDOWN_MAX_ENTRIES) {
    const oldestKey = lastAnalysisAt.keys().next().value;
    if (oldestKey !== undefined) lastAnalysisAt.delete(oldestKey);
  }
  lastAnalysisAt.set(userId, now);
  return true;
}

/** Test hook — wipes the in-memory cooldown map. */
export function _resetCooldownForTests(): void {
  lastAnalysisAt.clear();
}

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
  if (content.length < 3 || content.length > MAX_CONTENT_LENGTH) return false;

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
  if (typeof v.rule === 'string') verdict.rule = v.rule;
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

  const actor: Actor = { id: botUser.id, label: ACTOR_LABEL, type: 'ai' };
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

  // Per-user cooldown — guards the n8n workflow against bursts. Checked after
  // shouldAnalyze so an exempt/ignored message doesn't burn the user's slot.
  if (!checkCooldown(message.author.id)) {
    logger.debug('AI moderation: user within cooldown — skipping', {
      userId: message.author.id,
    });
    return;
  }

  const client = getClient();
  if (!client) return;

  // Fetch the user's recent warning history so the LLM can ground "repeated
  // rule-breaking" verdicts in actual evidence rather than guessing. Cheap —
  // small index-backed query against the warnings table.
  const recentSummaries = await warningRepo.getRecentWarningSummaries(
    message.author.id,
    RECENT_WARNINGS_LIMIT
  );
  const recentWarnings = recentSummaries.map((row) => ({
    reason: row.reason,
    issuedAt: row.issued_at.toISOString(),
  }));

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
      recentWarnings,
      serverRules: configManager.config.moderation.rulesText,
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

  // Record the AI decision itself (the transparent "why") on the dashboard
  // event log, in both shadow and enforce modes. In enforce mode the resulting
  // enforcement action is logged separately by the moderation-actions layer, so
  // the dashboard shows the decision and the action as two linked rows.
  await recordAiDecision(message, verdict, mode);

  if (mode === 'shadow') {
    await postShadowLog(message, verdict);
    return;
  }

  await enforce(message, verdict);
}

/** Map a non-`allow` verdict to a dashboard severity. */
function verdictSeverity(action: ModerationAction): ModerationSeverity {
  switch (action) {
    case 'timeout':
      return 'high';
    case 'warn':
      return 'medium';
    case 'delete':
      return 'low';
    default:
      return 'info';
  }
}

async function recordAiDecision(
  message: Message,
  verdict: ModerationVerdict,
  mode: string
): Promise<void> {
  await moderationLogRepo.record({
    guildId: message.guild?.id ?? null,
    eventType: 'ai_flag',
    severity: verdictSeverity(verdict.action),
    actorType: 'ai',
    actorId: message.client.user?.id ?? null,
    actorLabel: ACTOR_LABEL,
    targetUserId: message.author.id,
    targetUsername: message.author.tag,
    channelId: message.channelId,
    action: verdict.action,
    reason: verdict.reason ?? null,
    aiReasoning: verdict.reason ?? null,
    aiRule: verdict.rule ?? null,
    metadata: {
      mode,
      ...(verdict.duration ? { duration: verdict.duration } : {}),
    },
  });
}
