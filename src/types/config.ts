export interface DiscordConfig {
  token: string;
  clientId: string;
  serverId: string;
}

export interface N8NConfig {
  workflowUrl: string;
  apiKey: string;
}

export interface BotSettings {
  mentionResponse: string;
  restrictedResponse: string;
  /**
   * Human-facing server rules shown by the `/rules` command. Source: RULES_TEXT
   * env var. Unlike `moderation.rulesText` (the AI's rulebook), this is for
   * people, so a pointer + Discord link is fine. Empty = a "not configured" notice.
   */
  rulesText: string;
}

export type AiModerationMode = 'off' | 'shadow' | 'enforce';

export interface ModerationConfig {
  allowedRoles: string[];
  modLogChannelId?: string;
  aiMode: AiModerationMode;
  aiModerationUrl: string;
  /**
   * Allowlist of channel IDs that AI moderation analyses. Empty list = analyse
   * nothing (strict opt-in — operator must list channels explicitly).
   */
  includeChannels: string[];
  /**
   * Denylist of role IDs whose holders are skipped by AI moderation (mods,
   * admins, trusted bots, etc.). Empty list = no role-based exemption.
   */
  exemptRoles: string[];
  warnMuteThreshold: number;
  warnBanThreshold: number;
  /**
   * Per-user cooldown (ms) between AI moderation n8n calls. Guards against
   * flooding the moderation workflow when a single user posts a burst of
   * messages in an enrolled channel. 0 disables the cooldown.
   * Source: AI_MOD_USER_COOLDOWN_MS env var.
   */
  userCooldownMs: number;
  /**
   * Plain-text server rules surfaced to the AI moderation LLM. When empty
   * the LLM falls back to the generic community baseline in its system
   * prompt. Source: MOD_RULES_TEXT env var.
   */
  rulesText: string;
}

export interface LoggingConfig {
  level: string;
  dir: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string | undefined;
  ssl: boolean;
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
}

export interface HealthConfig {
  port: number;
}

export interface DashboardConfig {
  /** Master switch — the dashboard server only starts when true. */
  enabled: boolean;
  port: number;
  /** Discord OAuth2 client secret (the client ID is reused from `discord`). */
  oauthClientSecret: string;
  /** Absolute OAuth2 redirect URI registered on the Discord application. */
  oauthRedirectUri: string;
  /** Public base URL the dashboard is served from (used for absolute links). */
  publicBaseUrl: string;
  /** Secret used to HMAC-sign session + state cookies. */
  sessionSecret: string;
  /**
   * Roles permitted to view the dashboard, in addition to guild owner and
   * members holding Administrator/ManageGuild. Falls back to
   * `moderation.allowedRoles` when unset.
   */
  allowedRoles: string[];
  /** Send session cookies with the `Secure` attribute (required behind HTTPS). */
  cookieSecure: boolean;
  /** Session lifetime in seconds. */
  sessionTtlSeconds: number;
}

export interface BotConfig {
  discord: DiscordConfig;
  n8n: N8NConfig;
  bot: BotSettings;
  moderation: ModerationConfig;
  logging: LoggingConfig;
  database: DatabaseConfig;
  health: HealthConfig;
  dashboard: DashboardConfig;
}
