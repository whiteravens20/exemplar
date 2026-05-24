import { Events, ChannelType, type Message } from 'discord.js';
import logger from '../utils/logger.js';
import N8NClient from '../utils/n8n-client.js';
import RateLimiter from '../utils/rate-limiter.js';
import { hasPermission } from '../utils/permissions.js';
import configManager from '../config/config.js';
import { getTemplate } from '../config/response-templates.js';
import { splitMessage } from '../utils/message-splitter.js';
import conversationRepo from '../db/repositories/conversation-repository.js';
import analyticsRepo from '../db/repositories/analytics-repository.js';
import { estimateTokens } from '../utils/token-estimator.js';
import type { BotEvent } from '../types/discord.js';

const n8nClient = new N8NClient(
  configManager.config.n8n.workflowUrl,
  configManager.config.n8n.apiKey
);

// Rate limiter: 5 messages per minute
const rateLimiter = new RateLimiter(5, 60000);

// Cleanup old entries every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

// Constants
const MAX_MESSAGE_LENGTH = 4000;

// Track processed messages to prevent duplicates (bounded Map with TTL)
const processedMessages = new Map<string, number>();
const PROCESSED_MESSAGE_TTL = 60000; // 60 seconds
const PROCESSED_MESSAGES_MAX = 10000;

// Cleanup expired processed messages every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, timestamp] of processedMessages) {
    if (now - timestamp > PROCESSED_MESSAGE_TTL) {
      processedMessages.delete(id);
    }
  }
}, PROCESSED_MESSAGE_TTL);

const event: BotEvent = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    // Check if already processed (prevent duplicates)
    if (processedMessages.has(message.id)) {
      logger.warn('⚠️ Duplicate message detected, skipping', {
        messageId: message.id,
      });
      return;
    }
    processedMessages.set(message.id, Date.now());

    // Evict oldest entries if map exceeds max size
    if (processedMessages.size > PROCESSED_MESSAGES_MAX) {
      const firstKey = processedMessages.keys().next().value;
      if (firstKey) processedMessages.delete(firstKey);
    }

    // Fetch partial messages (required for DMs in Discord.js v14)
    if (message.partial) {
      try {
        await message.fetch();
        logger.info('Fetched partial message');
      } catch (error) {
        logger.error('Failed to fetch partial message', {
          error: (error as Error).message,
        });
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
      contentLength: message.content.length,
    });

    const botUser = message.client.user;
    if (!botUser) return;
    const botMention = `<@${botUser.id}>`;
    const botNicknameMention = `<@!${botUser.id}>`;

    // Handle bot mentions in public channels
    if (
      message.content.includes(botMention) ||
      message.content.includes(botNicknameMention)
    ) {
      if (message.channel.type !== ChannelType.DM) {
        try {
          await message.reply({
            content: configManager.config.bot.mentionResponse,
          });
          logger.info('✅ Sent mention response', {
            userId: message.author.id,
          });
        } catch (error) {
          logger.error('Error sending mention response', {
            error: (error as Error).message,
          });
        }
      }
      return;
    }

    // Handle DM messages for AI Assistant
    if (message.channel.type === ChannelType.DM) {
      try {
        const allowedRoles = configManager.getAllowedRoles();

        // Check if user has allowed role in the configured server
        let hasPermissionForAI = false;
        const serverId = configManager.config.discord.serverId;

        if (serverId && allowedRoles.length > 0) {
          const guild = message.client.guilds.cache.get(serverId);
          if (guild) {
            const member = await guild.members
              .fetch(message.author.id)
              .catch(() => null);
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
            content: configManager.config.bot.restrictedResponse,
          });
          logger.info('❌ User blocked - no permission', {
            userId: message.author.id,
          });
          return;
        }

        // Check rate limit
        const rateLimit = await rateLimiter.checkLimit(message.author.id);
        if (!rateLimit.allowed) {
          await message.reply({
            content: `⏳ Przekroczono limit wiadomości. Poczekaj ${rateLimit.retryAfter} sekund przed wysłaniem kolejnej wiadomości.`,
          });
          logger.warn('Rate limit exceeded', {
            userId: message.author.id,
            retryAfter: rateLimit.retryAfter,
          });
          return;
        }

        // Validate message length
        if (message.content.length > MAX_MESSAGE_LENGTH) {
          await message.reply({
            content: `❌ Wiadomość za długa. Maksymalna długość to ${MAX_MESSAGE_LENGTH} znaków.`,
          });
          logger.warn('Message too long', {
            userId: message.author.id,
            length: message.content.length,
          });
          return;
        }

        // Sanitize message content
        const sanitizedContent = message.content.trim();

        if (!sanitizedContent) {
          await message.reply({
            content: '❌ Otrzymano pustą wiadomość.',
          });
          return;
        }

        // All bot commands are slash commands handled by interactionCreate.
        // A plain DM is always a chat-mode message for the n8n workflow.
        const mode = 'chat';

        // Send to n8n workflow
        logger.info('📤 Sending message to n8n', {
          userId: message.author.id,
          userName: message.author.username,
          messageLength: sanitizedContent.length,
          remaining: rateLimit.remaining,
          mode,
        });

        // Get conversation context from database
        const conversationContext = await conversationRepo.getRecentMessages(
          message.author.id,
          20
        );

        // Show typing indicator - will repeat every 5 seconds
        const dmChannel = message.channel;
        if ('sendTyping' in dmChannel) {
          await dmChannel.sendTyping();
        }
        const typingInterval = setInterval(async () => {
          try {
            if ('sendTyping' in dmChannel) {
              await dmChannel.sendTyping();
            }
          } catch {
            clearInterval(typingInterval);
          }
        }, 5000);

        const startTime = Date.now();
        const result = await n8nClient.sendMessage(
          message.author.id,
          message.author.username,
          sanitizedContent,
          configManager.config.discord.serverId,
          mode,
          conversationContext
        );
        const responseTime = Date.now() - startTime;

        // Stop typing indicator
        clearInterval(typingInterval);

        if (result.success) {
          // Debug: log what we received from n8n
          logger.debug('n8n result:', {
            hasData: !!result.data,
            dataType: typeof result.data,
            hasResponseField: result.data?.response !== undefined,
            dataKeys: result.data ? Object.keys(result.data) : [],
            dataPreview: JSON.stringify(result.data).substring(0, 300),
          });

          // Check if response field exists
          if (!result.data?.response) {
            logger.error('❌ n8n response missing "response" field', {
              mode,
              receivedData: JSON.stringify(result.data).substring(0, 500),
              dataKeys: result.data ? Object.keys(result.data) : [],
            });

            await message.reply({
              content: '❌ Błąd konfiguracji n8n workflow. Brak pola "response" w odpowiedzi. Sprawdź konfigurację workflow.',
            });
            return;
          }

          const response = result.data.response;

          // Save conversation to database
          await conversationRepo
            .saveMessage(
              message.author.id,
              message.author.username,
              sanitizedContent,
              response
            )
            .catch((err: Error) =>
              logger.error('Failed to save conversation', {
                error: err.message,
              })
            );

          // Log analytics
          const totalTokens = estimateTokens(sanitizedContent + response);
          await analyticsRepo
            .logMessage(
              message.author.id,
              message.author.username,
              'dm',
              mode,
              responseTime,
              totalTokens
            )
            .catch((err: Error) =>
              logger.error('Failed to log analytics', { error: err.message })
            );

          logger.info('Extracted response', {
            mode,
            responseLength: response.length,
            responsePreview: response.substring(0, 100),
          });

          // Split long messages intelligently (Discord limit: 2000 chars)
          const chunks = splitMessage(response);

          for (const chunk of chunks) {
            await message.reply({ content: chunk });
          }

          logger.info('✅ n8n workflow processed successfully', {
            userId: message.author.id,
            responseLength: response.length,
            chunks: chunks.length,
          });
        } else {
          // Detailed error handling based on error type
          let errorMessage: string;
          const status = result.status;

          if (!status) {
            errorMessage = getTemplate('error', 'n8nDown');
            logger.error('❌ n8n unreachable (network error)', {
              userId: message.author.id,
              error: result.error,
              url: configManager.config.n8n.workflowUrl,
            });
          } else if (status === 404) {
            errorMessage = getTemplate('error', 'notFound');
            logger.error('❌ n8n workflow not found (404)', {
              userId: message.author.id,
              url: configManager.config.n8n.workflowUrl,
            });
          } else if (status === 401 || status === 403) {
            errorMessage =
              '🔒 Błąd uwierzytelnienia backendu. Sprawdź konfigurację klucza API.';
            logger.error('❌ n8n authentication error', {
              userId: message.author.id,
              status,
            });
          } else if (status >= 500) {
            errorMessage = getTemplate('error', 'n8nDown');
            logger.error('❌ n8n server error', {
              userId: message.author.id,
              status,
              error: result.error,
            });
          } else if (result.error?.includes('timeout')) {
            errorMessage = getTemplate('error', 'timeout');
            logger.error('❌ n8n timeout', {
              userId: message.author.id,
              error: result.error,
            });
          } else {
            errorMessage = getTemplate('error', 'processing');
            logger.error('❌ n8n workflow error', {
              userId: message.author.id,
              status,
              error: result.error,
            });
          }

          await message.reply({ content: errorMessage });
        }
      } catch (error) {
        logger.error('❌ Error handling DM', {
          userId: message.author.id,
          error: (error as Error).message,
          stack: (error as Error).stack,
        });

        // Determine appropriate error message
        let errorMessage = getTemplate('error', 'generic');

        if ((error as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
          errorMessage = getTemplate('error', 'n8nDown');
        } else if ((error as Error).message.includes('timeout')) {
          errorMessage = getTemplate('error', 'timeout');
        }

        try {
          await message.reply({ content: errorMessage });
        } catch (replyError) {
          logger.error('❌ Failed to send error message', {
            userId: message.author.id,
            error: (replyError as Error).message,
          });
        }
      }
    }
  },
};

export default event;
