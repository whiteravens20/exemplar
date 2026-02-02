const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class ConfigManager {
  constructor() {
    this.config = {
      discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID,
        serverId: process.env.DISCORD_SERVER_ID
      },
      n8n: {
        workflowUrl: process.env.N8N_WORKFLOW_URL,
        apiKey: process.env.N8N_API_KEY || ''
      },
      bot: {
        prefix: process.env.BOT_PREFIX || '!',
        mentionResponse: process.env.HARDCODED_MENTION_RESPONSE || 'Hi! I\'m an AI Assistant. Send me a DM to chat with me.',
        restrictedResponse: process.env.RESTRICTED_RESPONSE || 'You don\'t have permission to use this feature. Please contact the admins.'
      },
      moderation: {
        allowedRoles: this.parseRoles(process.env.ALLOWED_ROLES_FOR_AI)
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        dir: path.join(process.cwd(), 'logs')
      }
    };

    this.ensureLogsDir();
  }

  parseRoles(roleString) {
    if (!roleString) return [];
    return roleString.split(',').map(role => role.trim()).filter(role => role.length > 0);
  }

  ensureLogsDir() {
    const logDir = this.config.logging.dir;
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      logger.info(`Created logs directory: ${logDir}`);
    }
  }

  getConfig() {
    return this.config;
  }

  validateRequiredConfig() {
    const required = [
      'discord.token',
      'discord.clientId',
      'discord.serverId',
      'n8n.workflowUrl'
    ];

    for (const path of required) {
      const [category, key] = path.split('.');
      if (!this.config[category]?.[key]) {
        logger.error(`Missing required configuration: ${path}`);
        return false;
      }
    }

    return true;
  }

  hasAIAccessRoles() {
    return this.config.moderation.allowedRoles.length > 0;
  }

  getAllowedRoles() {
    return this.config.moderation.allowedRoles;
  }
}

module.exports = new ConfigManager();
