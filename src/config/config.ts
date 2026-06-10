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
        userCooldownMs: this.parseNonNegativeInt(
          process.env.AI_MOD_USER_COOLDOWN_MS,
          5000
        ),
        rulesText: process.env.MOD_RULES_TEXT || '',
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
      dashboard: {
        enabled: process.env.DASHBOARD_ENABLED === 'true',
        port: parseInt(process.env.DASHBOARD_PORT || '3001', 10),
        oauthClientSecret: process.env.DISCORD_CLIENT_SECRET || '',
        oauthRedirectUri:
          process.env.DASHBOARD_OAUTH_REDIRECT_URI ||
          'http://localhost:3001/callback',
        publicBaseUrl:
          process.env.DASHBOARD_PUBLIC_BASE_URL || 'http://localhost:3001',
        sessionSecret: process.env.DASHBOARD_SESSION_SECRET || '',
        // Falls back to the AI moderation allowed-roles list when a dashboard
        // specific list isn't provided.
        allowedRoles: this.parseRoles(
          process.env.DASHBOARD_ALLOWED_ROLES ||
            process.env.ALLOWED_ROLES_FOR_AI
        ),
        cookieSecure: process.env.DASHBOARD_COOKIE_SECURE === 'true',
        sessionTtlSeconds: this.parsePositiveInt(
          process.env.DASHBOARD_SESSION_TTL_SECONDS,
          12 * 60 * 60
        ),
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

  parseNonNegativeInt(value: string | undefined, fallback: number): number {
    if (value === undefined || value === '') return fallback;
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
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

    if (!this.validateDashboardConfig()) return false;

    return true;
  }

  /**
   * When the dashboard is enabled, its security-critical secrets must be set
   * and strong. Fail fast at startup rather than booting an unprotected admin
   * surface. No-op when the dashboard is disabled.
   */
  validateDashboardConfig(): boolean {
    const dash = this.config.dashboard;
    if (!dash.enabled) return true;

    if (!this.config.discord.clientId) {
      logger.error('Dashboard enabled but DISCORD_CLIENT_ID is missing');
      return false;
    }
    if (!dash.oauthClientSecret) {
      logger.error('Dashboard enabled but DISCORD_CLIENT_SECRET is missing');
      return false;
    }
    if (!dash.sessionSecret || dash.sessionSecret.length < 32) {
      logger.error(
        'Dashboard enabled but DASHBOARD_SESSION_SECRET is missing or shorter than 32 characters'
      );
      return false;
    }
    if (!dash.oauthRedirectUri) {
      logger.error('Dashboard enabled but DASHBOARD_OAUTH_REDIRECT_URI is missing');
      return false;
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
