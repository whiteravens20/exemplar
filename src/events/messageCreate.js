const { Events, ChannelType } = require('discord.js');
const logger = require('../utils/logger');
const N8NClient = require('../utils/n8n-client');
const RateLimiter = require('../utils/rate-limiter');
const { hasPermission } = require('../utils/permissions');
const config = require('../config/config');
const { getTemplate } = require('../config/response-templates');

const n8nClient = new N8NClient(
  config.config.n8n.workflowUrl,
  config.config.n8n.apiKey
);

// Rate limiter: 5 messages per minute
const rateLimiter = new RateLimiter(5, 60000);

// Cleanup old entries every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

// Constants
const MAX_MESSAGE_LENGTH = 4000;

// Track processed messages to prevent duplicates
const processedMessages = new Set();
const PROCESSED_MESSAGE_TTL = 60000; // 60 seconds

// Cleanup processed messages every minute
setInterval(() => {
  processedMessages.clear();
}, PROCESSED_MESSAGE_TTL);

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Check if already processed (prevent duplicates)
    if (processedMessages.has(message.id)) {
      logger.warn('⚠️ Duplicate message detected, skipping', { messageId: message.id });
      return;
    }
    processedMessages.add(message.id);

    // Fetch partial messages (required for DMs in Discord.js v14)
    if (message.partial) {
      try {
        await message.fetch();
        logger.info('Fetched partial message');
      } catch (error) {
        logger.error('Failed to fetch partial message', { error: error.message });
        return;
      }
    }

    // Ignore bot messages
    if (message.author.bot) return;

    // Log all incoming messages for debugging
    logger.info('📨 Message received', {
      channelType: message.channel.type,
      isDM: message.channel.type === ChannelType.DM,
      userId: message.author.id,
      username: message.author.username,
      contentLength: message.content.length
    });

    const botMention = `<@${message.client.user.id}>`;
    const botNicknameMention = `<@!${message.client.user.id}>`;

    // Handle bot mentions in public channels
    if (message.content.includes(botMention) || message.content.includes(botNicknameMention)) {
      if (message.channel.type !== ChannelType.DM) {
        try {
          await message.reply({
            content: config.config.bot.mentionResponse
          });
          logger.info('✅ Sent mention response', { userId: message.author.id });
        } catch (error) {
          logger.error('Error sending mention response', { error: error.message });
        }
      }
      return;
    }

    // Handle DM messages for AI Assistant
    if (message.channel.type === ChannelType.DM) {
      try {
        const allowedRoles = config.getAllowedRoles();
        
        // Check if user has allowed role in the configured server
        let hasPermissionForAI = false;
        const serverId = config.config.discord.serverId;
        
        if (serverId && allowedRoles.length > 0) {
          const guild = message.client.guilds.cache.get(serverId);
          if (guild) {
            const member = await guild.members.fetch(message.author.id).catch(() => null);
            if (member) {
              hasPermissionForAI = hasPermission(member, allowedRoles);
            }
          }
        } else if (allowedRoles.length === 0) {
          // No roles configured - everyone has access
          hasPermissionForAI = true;
        }

        if (!hasPermissionForAI) {
          await message.reply({
            content: config.config.bot.restrictedResponse
          });
          logger.info('❌ User blocked - no permission', { userId: message.author.id });
          return;
        }

        // Check rate limit
        const rateLimit = rateLimiter.checkLimit(message.author.id);
        if (!rateLimit.allowed) {
          await message.reply({
            content: `⏳ Przekroczono limit wiadomości. Poczekaj ${rateLimit.retryAfter} sekund przed wysłaniem kolejnej wiadomości.`
          });
          logger.warn('Rate limit exceeded', { 
            userId: message.author.id,
            retryAfter: rateLimit.retryAfter 
          });
          return;
        }

        // Validate message length
        if (message.content.length > MAX_MESSAGE_LENGTH) {
          await message.reply({
            content: `❌ Wiadomość za długa. Maksymalna długość to ${MAX_MESSAGE_LENGTH} znaków.`
          });
          logger.warn('Message too long', { 
            userId: message.author.id,
            length: message.content.length 
          });
          return;
        }

        // Sanitize message content
        const sanitizedContent = message.content.trim();
        
        if (!sanitizedContent) {
          await message.reply({
            content: '❌ Otrzymano pustą wiadomość.'
          });
          return;
        }

        // Send to n8n workflow
        logger.info('📤 Sending message to n8n', {
          userId: message.author.id,
          userName: message.author.username,
          messageLength: sanitizedContent.length,
          remaining: rateLimit.remaining
        });

        // Show typing indicator - will repeat every 5 seconds
        await message.channel.sendTyping();
         const typingInterval = setInterval(async () => {
          try {
            await message.channel.sendTyping();
          } catch (_) {
            clearInterval(typingInterval);
          }
        }, 5000);

        const result = await n8nClient.sendMessage(
          message.author.id,
          message.author.username,
          sanitizedContent,
          config.config.discord.serverId
        );

        // Stop typing indicator
        clearInterval(typingInterval);

        if (result.success) {
          const response = result.data?.response || 'Twoja wiadomość została przetworzona.';
          
          // Split long messages (Discord limit: 2000 chars)
          if (response.length > 2000) {
            const chunks = response.match(/[\s\S]{1,2000}/g);
            for (const chunk of chunks) {
              await message.reply({ content: chunk });
            }
          } else {
            await message.reply({ content: response });
          }
          
          logger.info('✅ n8n workflow processed successfully', { userId: message.author.id });
        } else {
          // Detailed error handling based on error type
          let errorMessage;
          const status = result.status;
          
          if (!status) {
            // Network error - n8n likely unreachable
            errorMessage = getTemplate('error', 'n8nDown');
            logger.error('❌ n8n unreachable (network error)', { 
              userId: message.author.id,
              error: result.error,
              url: config.config.n8n.workflowUrl
            });
          } else if (status === 404) {
            // Workflow not found
            errorMessage = getTemplate('error', 'notFound');
            logger.error('❌ n8n workflow not found (404)', { 
              userId: message.author.id,
              url: config.config.n8n.workflowUrl
            });
          } else if (status === 401 || status === 403) {
            // Authentication error
            errorMessage = '🔒 Błąd uwierzytelnienia backendu. Sprawdź konfigurację klucza API.';
            logger.error('❌ n8n authentication error', { 
              userId: message.author.id,
              status
            });
          } else if (status >= 500) {
            // Server error
            errorMessage = getTemplate('error', 'n8nDown');
            logger.error('❌ n8n server error', { 
              userId: message.author.id,
              status,
              error: result.error
            });
          } else if (result.error?.includes('timeout')) {
            // Timeout error
            errorMessage = getTemplate('error', 'timeout');
            logger.error('❌ n8n timeout', { 
              userId: message.author.id,
              error: result.error
            });
          } else {
            // Generic error
            errorMessage = getTemplate('error', 'processing');
            logger.error('❌ n8n workflow error', { 
              userId: message.author.id,
              status,
              error: result.error 
            });
          }
          
          await message.reply({ content: errorMessage });
        }
      } catch (error) {
        logger.error('❌ Error handling DM', { 
          userId: message.author.id,
          error: error.message,
          stack: error.stack
        });
        
        // Determine appropriate error message
        let errorMessage = getTemplate('error', 'generic');
        
        if (error.code === 'ECONNREFUSED') {
          errorMessage = getTemplate('error', 'n8nDown');
        } else if (error.message.includes('timeout')) {
          errorMessage = getTemplate('error', 'timeout');
        }
        
        try {
          await message.reply({ content: errorMessage });
        } catch (replyError) {
          logger.error('❌ Failed to send error message', { 
            userId: message.author.id,
            error: replyError.message 
          });
        }
      }
    }
  }
};
