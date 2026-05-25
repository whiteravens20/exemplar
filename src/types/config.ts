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

export interface BotConfig {
  discord: DiscordConfig;
  n8n: N8NConfig;
  bot: BotSettings;
  moderation: ModerationConfig;
  logging: LoggingConfig;
  database: DatabaseConfig;
  health: HealthConfig;
}
