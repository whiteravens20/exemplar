import {
  ChannelType,
  EmbedBuilder,
  type Guild,
  type Message,
  type TextChannel,
} from 'discord.js';
import logger from './logger.js';
import { i18n, t } from './i18n.js';
import configManager from '../config/config.js';
import N8NClient from './n8n-client.js';
import { ConcurrencyLimiter } from './concurrency-limiter.js';
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

const RECENT_WARNINGS_LIMIT = 5;
// Discord caps audit-log reasons at 512 characters.
const MAX_REASON_LENGTH = 512;
// Upper bound on message length forwarded to n8n. Discord's own 2 000-char
// guild limit keeps real messages well under this, so the cap is a defensive
// guard (and self-documenting intent) against any future path that bypasses
// Discord's limit — not a constraint operators are expected to hit.
const MAX_CONTENT_LENGTH = 4000;
// Messages waiting for their turn at the moderation workflow. Only a flood
// reaches this; past it a message is not analysed, and that is logged.
const MAX_QUEUED_MESSAGES = 1000;
// Longer than the assistant's two minutes: nobody is waiting for this answer,
// and a model that has to be loaded first can spend most of that before it
// starts on the message.
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
// A request that failed goes back to the end of the queue after a pause, so a
// restart of n8n or a model that was busy costs a delay, not the verdict. The
// pauses before the second and the third attempt; there is no fourth.
const RETRY_DELAYS_MS = [30 * 1000, 60 * 1000];
// Past this age a message is not retried any more.
const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000;
// Messages given up on are reported to the mod-log together, at most this
// often, so an outage does not flood the channel.
const UNCHECKED_REPORT_INTERVAL_MS = 10 * 60 * 1000;

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

/**
 * Every eligible message is analysed. At most AI_MOD_MAX_CONCURRENT requests
 * are with the moderation workflow at a time and the rest wait their turn, so
 * a burst reaches the model as a steady stream instead of piling up until
 * requests time out. A verdict that arrives late still gets acted on.
 */
const queue = new ConcurrencyLimiter(
  () => configManager.config.moderation.maxConcurrent,
  MAX_QUEUED_MESSAGES
);

function getClient(): N8NClient | null {
  const { aiModerationUrl } = configManager.config.moderation;
  if (!aiModerationUrl) return null;
  if (!cachedClient) {
    cachedClient = new N8NClient(aiModerationUrl, configManager.config.n8n.apiKey, {
      timeout: REQUEST_TIMEOUT_MS,
    });
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
  const skip = (reason: string): false => {
    logger.debug('AI moderation: message skipped', {
      reason,
      channelId: message.channelId,
      channelType: message.channel.type,
      userId: message.author.id,
    });
    return false;
  };

  if (message.author.bot || message.system) return skip('author is bot/system');
  if (message.channel.type !== ChannelType.GuildText)
    return skip('channel is not a standard text channel (thread/forum/news?)');
  if (!message.guild) return skip('no guild');

  const { includeChannels, exemptRoles } = configManager.config.moderation;

  // Strict opt-in: empty allowlist means "analyse nothing". Operators must
  // list channels in AI_MOD_INCLUDE_CHANNELS to enrol them in moderation.
  // This keeps high-volume read-only channels (announcements, news) and any
  // unconfigured channel out of the n8n round-trip by default.
  if (includeChannels.length === 0)
    return skip('AI_MOD_INCLUDE_CHANNELS is empty');
  if (!includeChannels.includes(message.channelId))
    return skip('channel not in AI_MOD_INCLUDE_CHANNELS');

  if (exemptRoles.length > 0 && message.member) {
    const memberRoleIds = new Set(message.member.roles.cache.keys());
    if (exemptRoles.some((id) => memberRoleIds.has(id)))
      return skip('author holds an AI_MOD_EXEMPT_ROLES role');
  }

  const content = (message.content || '').trim();
  if (content.length < 3 || content.length > MAX_CONTENT_LENGTH)
    return skip('content too short/long or empty (missing MessageContent intent?)');

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
  if (typeof v.reason === 'string')
    verdict.reason = v.reason.slice(0, MAX_REASON_LENGTH);
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
  if (!modLogChannelId || !message.guild) {
    logger.warn('Shadow verdict not posted: MOD_LOG_CHANNEL_ID is unset', {
      userId: message.author.id,
    });
    return;
  }

  const channel = message.guild.channels.cache.get(modLogChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    logger.warn('Shadow verdict not posted: mod-log channel not found or not a text channel', {
      modLogChannelId,
      found: !!channel,
      channelType: channel?.type,
    });
    return;
  }

  const preview = buildPreview(message.content);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(t('aiModeration.shadowTitle', { action: verdict.action }))
    .addFields(
      {
        name: t('moderation.fields.user'),
        value: `${message.author.tag} (${message.author.id})`,
        inline: true,
      },
      {
        name: t('moderation.fields.channel'),
        value: `<#${message.channelId}>`,
        inline: true,
      },
      {
        name: t('moderation.fields.reason'),
        value: verdict.reason || t('aiModeration.noReason'),
      }
    )
    .setTimestamp();

  if (verdict.action === 'timeout' && verdict.duration) {
    embed.addFields({
      name: t('moderation.fields.duration'),
      value: verdict.duration,
      inline: true,
    });
  }
  embed.addFields({ name: t('moderation.fields.content'), value: preview });
  embed.setFooter({ text: t('aiModeration.shadowFooter') });

  try {
    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to post shadow-mode mod-log entry', {
      error: (error as Error).message,
      userId: message.author.id,
    });
  }
}

/**
 * Tell the moderators that a verdict could not be carried out — typically a
 * missing permission, such as Manage Messages for a delete. Otherwise the
 * failure is only in the bot's log and the message stays up unnoticed.
 */
async function postFailureLog(
  message: Message,
  verdict: ModerationVerdict,
  detail: string | undefined
): Promise<void> {
  const modLogChannelId = configManager.config.moderation.modLogChannelId;
  const channel = modLogChannelId
    ? message.guild?.channels.cache.get(modLogChannelId)
    : undefined;
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(t('aiModeration.failedTitle', { action: verdict.action }))
    .addFields(
      {
        name: t('moderation.fields.user'),
        value: `${message.author.tag} (${message.author.id})`,
        inline: true,
      },
      {
        name: t('moderation.fields.channel'),
        value: `<#${message.channelId}>`,
        inline: true,
      },
      {
        name: t('moderation.fields.reason'),
        value: verdict.reason || t('aiModeration.noReason'),
      },
      {
        name: t('moderation.fields.problem'),
        value: detail || t('errors.operationFailed'),
      },
      { name: t('moderation.fields.content'), value: buildPreview(message.content) }
    )
    .setFooter({ text: t('aiModeration.failedFooter') })
    .setTimestamp();

  try {
    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to post the AI moderation failure to the mod-log', {
      error: (error as Error).message,
      userId: message.author.id,
    });
  }
}

function buildPreview(content: string): string {
  const trimmed = (content || '').trim();
  if (!trimmed) return t('moderation.emptyMessage');
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

  const actor: Actor = {
    id: botUser.id,
    label: t('moderation.aiModerator'),
    type: 'ai',
  };
  const reason = verdict.reason || t('aiModeration.defaultReason');

  switch (verdict.action) {
    case 'warn': {
      const result = await applyWarn(guild, message.author, reason, actor);
      if (!result.success) {
        logger.warn('AI moderation warn failed', {
          userId: message.author.id,
          detail: result.content,
        });
        await postFailureLog(message, verdict, result.content);
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
        await postFailureLog(message, verdict, result.content);
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
        await postFailureLog(message, verdict, result.content);
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

  const firstQueuedAt = Date.now();
  for (let attempt = 1; ; attempt++) {
    const queuedAt = Date.now();
    if (!(await queue.acquire())) {
      giveUp(message, 'the moderation queue is full');
      return;
    }
    let failure: string | null;
    try {
      failure = await analyze(message, client, Date.now() - queuedAt);
    } finally {
      queue.release();
    }
    if (failure === null) return;

    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (
      delay === undefined ||
      Date.now() - firstQueuedAt + delay > MAX_MESSAGE_AGE_MS
    ) {
      giveUp(message, failure);
      return;
    }
    logger.info('AI moderation: request failed — message goes back to the queue', {
      userId: message.author.id,
      attempt,
      retryInMs: delay,
      error: failure,
    });
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

let unchecked = { count: 0, channels: new Set<string>(), lastError: '' };
let lastUncheckedReportAt = 0;
let uncheckedReportTimer: NodeJS.Timeout | null = null;

/**
 * A message the workflow never judged. It is counted and reported to the
 * moderators: the first one straight away, later ones together.
 */
function giveUp(message: Message, error: string): void {
  logger.error('AI moderation: message not analysed', {
    userId: message.author.id,
    channelId: message.channelId,
    messageId: message.id,
    error,
  });

  unchecked.count++;
  unchecked.channels.add(message.channelId);
  unchecked.lastError = error;

  const guild = message.guild;
  if (!guild) return;
  const wait = lastUncheckedReportAt + UNCHECKED_REPORT_INTERVAL_MS - Date.now();
  if (wait <= 0) {
    void postUncheckedReport(guild);
  } else if (!uncheckedReportTimer) {
    uncheckedReportTimer = setTimeout(() => {
      uncheckedReportTimer = null;
      void postUncheckedReport(guild);
    }, wait);
    uncheckedReportTimer.unref();
  }
}

async function postUncheckedReport(guild: Guild): Promise<void> {
  const report = unchecked;
  unchecked = { count: 0, channels: new Set<string>(), lastError: '' };
  lastUncheckedReportAt = Date.now();
  if (report.count === 0) return;

  const modLogChannelId = configManager.config.moderation.modLogChannelId;
  const channel = modLogChannelId
    ? guild.channels.cache.get(modLogChannelId)
    : undefined;
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(t('aiModeration.uncheckedTitle'))
    .addFields(
      {
        name: t('aiModeration.uncheckedCount'),
        value: String(report.count),
        inline: true,
      },
      {
        name: t('moderation.fields.channel'),
        value: [...report.channels].map((id) => `<#${id}>`).join(' '),
        inline: true,
      },
      {
        name: t('moderation.fields.problem'),
        value: report.lastError.slice(0, 1000) || t('errors.operationFailed'),
      }
    )
    .setFooter({ text: t('aiModeration.uncheckedFooter') })
    .setTimestamp();

  try {
    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to post the unchecked-messages notice to the mod-log', {
      error: (error as Error).message,
    });
  }
}

/**
 * One attempt at a verdict for `message`. Resolves to null once the message
 * has been dealt with, or to what went wrong when the workflow did not answer
 * and the message should be tried again.
 */
async function analyze(
  message: Message,
  client: N8NClient,
  waitedMs: number
): Promise<string | null> {

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
      language: i18n.language,
    });
  } catch (error) {
    logger.error('AI moderation: n8n request threw', {
      error: (error as Error).message,
      userId: message.author.id,
    });
    return (error as Error).message;
  }

  if (!result.success) {
    logger.warn('AI moderation: n8n returned failure', {
      userId: message.author.id,
      status: result.status,
      error: result.error,
    });
    return result.error ?? `HTTP ${result.status}`;
  }

  const verdict = validateVerdict(
    (result.data as { verdict?: unknown } | undefined)?.verdict
  );
  if (!verdict) {
    logger.error('AI moderation: malformed verdict from n8n', {
      userId: message.author.id,
      data: JSON.stringify(result.data).slice(0, 300),
    });
    return null;
  }

  const mode = configManager.config.moderation.aiMode;

  // Surface every verdict so the decision trail is visible in the logs (and not
  // just on the dashboard). `allow` verdicts intentionally produce no mod-log
  // entry — log them so a benign test message doesn't look like a silent failure.
  logger.info('AI moderation verdict', {
    action: verdict.action,
    reason: verdict.reason,
    mode,
    userId: message.author.id,
    channelId: message.channelId,
    waitedMs,
  });

  if (verdict.action === 'allow') return null;

  // Record the AI decision itself (the transparent "why") on the dashboard
  // event log, in both shadow and enforce modes. In enforce mode the resulting
  // enforcement action is logged separately by the moderation-actions layer, so
  // the dashboard shows the decision and the action as two linked rows.
  await recordAiDecision(message, verdict, mode);

  if (mode === 'shadow') {
    await postShadowLog(message, verdict);
    return null;
  }

  await enforce(message, verdict);
  return null;
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
    actorLabel: t('moderation.aiModerator'),
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
