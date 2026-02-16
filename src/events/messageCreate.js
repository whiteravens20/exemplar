const { Events, ChannelType } = require('discord.js');
const logger = require('../utils/logger');
const N8NClient = require('../utils/n8n-client');
const RateLimiter = require('../utils/rate-limiter');
const { hasPermission } = require('../utils/permissions');
const config = require('../config/config');
const { getTemplate } = require('../config/response-templates');
const { splitMessage } = require('../utils/message-splitter');
const conversationRepo = require('../db/repositories/conversation-repository');
const analyticsRepo = require('../db/repositories/analytics-repository');
const { estimateTokens } = require('../utils/token-estimator');
const { handleAdminCommand } = require('../utils/admin-command-handler');

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

    // Ignore messages starting with ! in channels (not DMs)
    if (message.channel.type !== ChannelType.DM && message.content.startsWith(config.config.bot.prefix)) {
      logger.info('Ignoring ! command in channel', { userId: message.author.id });
      return;
    }

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
        const rateLimit = await rateLimiter.checkLimit(message.author.id);
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
        let sanitizedContent = message.content.trim();
        
        if (!sanitizedContent) {
          await message.reply({
            content: '❌ Otrzymano pustą wiadomość.'
          });
          return;
        }

        // Check for !help command
        if (sanitizedContent === '!help' || sanitizedContent.startsWith('!help ')) {
          const embed = {
            color: 0x0099FF,
            title: '🤖 AI Assistant Bot - Pomoc',
            description: 'Witaj! Jestem botem AI dostępnym w wiadomościach prywatnych.',
            fields: [
              {
                name: '💬 Jak ze mnie korzystać?',
                value: 'Wyślij mi wiadomość prywatną (DM), aby ze mną porozmawiać! Mogę pomóc z pytaniami i udzielić informacji.'
              },
              {
                name: '⚡ Tryb kodowania',
                value: 'Użyj `!code` przed swoją wiadomością, aby przełączyć na tryb pomocy programistycznej.\n**Przykład:** `!code napisz funkcję do sortowania tablicy`'
              },
              {
                name: '📋 Dostępne komendy użytkownika',
                value: '• `!help` - Pokazuje tę wiadomość pomocy\n• `!code <pytanie>` - Tryb programistyczny\n• `!flushmemory` - Wyczyść pamięć konwersacji\n• `!warnings` - Pokaż swoje ostrzeżenia'
              },
              {
                name: '🔐 Komendy administratora',
                value: '• `!warn <@user> [powód]` - Wystaw ostrzeżenie\n• `!warnings [@user]` - Pokaż wszystkie ostrzeżenia\n• `!stats [days]` - Statystyki bota (domyślnie 7 dni)\n• `!flushdb confirm` - Wyczyść bazę danych'
              },
              {
                name: '📌 Funkcje',
                value: '• Oznacz mnie (@mention) na kanale, aby otrzymać informację o bocie\n• Wszystkie komendy działają tylko w DM\n• Bot automatycznie moderuje serwer'
              },
              {
                name: '⚠️ Uwaga',
                value: 'Dostęp do bota może być ograniczony do określonych ról. Jeśli nie możesz wysyłać wiadomości, skontaktuj się z administratorami serwera.'
              }
            ],
            timestamp: new Date()
          };

          await message.reply({ embeds: [embed] });
          logger.info('✅ Sent help command response', { userId: message.author.id });
          return;
        }

        // Check for admin commands (!flushdb, !flushmemory, !stats, !warn, !warnings)
        if (sanitizedContent.startsWith('!flush') || sanitizedContent.startsWith('!stats') || sanitizedContent.startsWith('!warn')) {
          await handleAdminCommand(message);
          return;
        }

        // Check for !code command to enable coding mode
        let mode = 'chat';
        if (sanitizedContent.startsWith('!code ')) {
          mode = 'code';
          sanitizedContent = sanitizedContent.substring(6).trim(); // Remove '!code ' prefix
          
          if (!sanitizedContent) {
            await message.reply({
              content: '❌ Podaj treść po komendzie !code'
            });
            return;
          }
        }

        // Send to n8n workflow
        logger.info('📤 Sending message to n8n', {
          userId: message.author.id,
          userName: message.author.username,
          messageLength: sanitizedContent.length,
          remaining: rateLimit.remaining,
          mode
        });

        // Get conversation context from database
        const conversationContext = await conversationRepo.getRecentMessages(message.author.id, 20);

        // Show typing indicator - will repeat every 5 seconds
        await message.channel.sendTyping();
         const typingInterval = setInterval(async () => {
          try {
            await message.channel.sendTyping();
          } catch (_) {
            clearInterval(typingInterval);
          }
        }, 5000);

        const startTime = Date.now();
        const result = await n8nClient.sendMessage(
          message.author.id,
          message.author.username,
          sanitizedContent,
          config.config.discord.serverId,
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
            dataPreview: JSON.stringify(result.data).substring(0, 300)
          });

          // Check if response field exists
          if (!result.data?.response) {
            logger.error('❌ n8n response missing "response" field', {
              mode,
              receivedData: JSON.stringify(result.data).substring(0, 500),
              dataKeys: result.data ? Object.keys(result.data) : []
            });
            
            await message.reply({
              content: `❌ Błąd konfiguracji n8n workflow.\n\n**Problem:** Brak pola "response" w odpowiedzi.\n**Tryb:** ${mode}\n**Otrzymane dane:** ${JSON.stringify(Object.keys(result.data || {}))}\n\nSprawdź workflow n8n - node dla trybu "${mode}" powinien zwracać:\n\`\`\`json\n{ "response": "treść odpowiedzi" }\n\`\`\``
            });
            return;
          }

          const response = result.data.response;

          // Save conversation to database
          await conversationRepo.saveMessage(
            message.author.id,
            message.author.username,
            sanitizedContent,
            response
          ).catch(err => logger.error('Failed to save conversation', { error: err.message }));

          // Log analytics
          const totalTokens = estimateTokens(sanitizedContent + response);
          await analyticsRepo.logMessage(
            message.author.id,
            message.author.username,
            'dm',
            mode,
            responseTime,
            totalTokens
          ).catch(err => logger.error('Failed to log analytics', { error: err.message }));
          
          logger.info('Extracted response', {
            mode,
            responseLength: response.length,
            responsePreview: response.substring(0, 100)
          });
          
          // Split long messages intelligently (Discord limit: 2000 chars)
          // Splits by paragraphs, preserves code blocks, avoids breaking words
          const chunks = splitMessage(response);
          
          for (const chunk of chunks) {
            await message.reply({ content: chunk });
          }
          
          logger.info('✅ n8n workflow processed successfully', { 
            userId: message.author.id,
            responseLength: response.length,
            chunks: chunks.length
          });
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
