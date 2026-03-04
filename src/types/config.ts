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
  prefix: string;
  mentionResponse: string;
  restrictedResponse: string;
}

export interface ModerationConfig {
  allowedRoles: string[];
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
