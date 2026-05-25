import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import type { BotConfig, AiModerationMode } from '../types/config.js';

class ConfigManager {
  public config: BotConfig;

  constructor() {
    this.config = {
      discord: {
        token: process.env.DISCORD_TOKEN || '',
        clientId: process.env.DISCORD_CLIENT_ID || '',
        serverId: process.env.DISCORD_SERVER_ID || '',
      },
      n8n: {
        workflowUrl: process.env.N8N_WORKFLOW_URL || '',
        apiKey: process.env.N8N_API_KEY || '',
      },
      bot: {
        mentionResponse:
          process.env.HARDCODED_MENTION_RESPONSE ||
          "Hi! I'm an AI Assistant. Send me a DM to chat with me.",
        restrictedResponse:
          process.env.RESTRICTED_RESPONSE ||
          "You don't have permission to use this feature. Please contact the admins.",
      },
      moderation: {
        allowedRoles: this.parseRoles(process.env.ALLOWED_ROLES_FOR_AI),
        modLogChannelId: process.env.MOD_LOG_CHANNEL_ID || undefined,
        aiMode: this.parseAiMode(process.env.AI_MODERATION_MODE),
        aiModerationUrl: process.env.N8N_MODERATION_WORKFLOW_URL || '',
        includeChannels: this.parseRoles(process.env.AI_MOD_INCLUDE_CHANNELS),
        exemptRoles: this.parseRoles(process.env.AI_MOD_EXEMPT_ROLES),
        warnMuteThreshold: this.parsePositiveInt(
          process.env.AI_MOD_MUTE_THRESHOLD,
          3
        ),
        warnBanThreshold: this.parsePositiveInt(
          process.env.AI_MOD_BAN_THRESHOLD,
          100
        ),
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        dir: path.join(process.cwd(), 'logs'),
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME || 'discord_bot',
        user: process.env.DB_USER || 'bot_user',
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
        idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        connectionTimeoutMs: parseInt(
          process.env.DB_CONNECTION_TIMEOUT || '5000',
          10
        ),
      },
      health: {
        port: parseInt(process.env.HEALTH_CHECK_PORT || '3000', 10),
      },
    };

    this.ensureLogsDir();
  }

  parseAiMode(value: string | undefined): AiModerationMode {
    const normalised = (value || 'off').toLowerCase();
    if (normalised === 'shadow' || normalised === 'enforce') return normalised;
    if (normalised !== 'off' && value !== undefined) {
      logger.warn(
        `Unknown AI_MODERATION_MODE="${value}" — treating as "off"`
      );
    }
    return 'off';
  }

  parsePositiveInt(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  }

  parseRoles(roleString: string | undefined): string[] {
    if (!roleString) return [];
    return roleString
      .split(',')
      .map((role) => role.trim())
      .filter((role) => role.length > 0);
  }

  ensureLogsDir(): void {
    const logDir = this.config.logging.dir;
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      logger.info(`Created logs directory: ${logDir}`);
    }
  }

  getConfig(): BotConfig {
    return this.config;
  }

  validateRequiredConfig(): boolean {
    const required = [
      'discord.token',
      'discord.clientId',
      'discord.serverId',
      'n8n.workflowUrl',
    ];

    for (const configPath of required) {
      const [category, key] = configPath.split('.');
      const section = this.config[category as keyof BotConfig];
      if (
        section &&
        typeof section === 'object' &&
        !(section as unknown as Record<string, unknown>)[key]
      ) {
        logger.error(`Missing required configuration: ${configPath}`);
        return false;
      }
    }

    return true;
  }

  hasAIAccessRoles(): boolean {
    return this.config.moderation.allowedRoles.length > 0;
  }

  getAllowedRoles(): string[] {
    return this.config.moderation.allowedRoles;
  }
}

export default new ConfigManager();
