const { Events, ChannelType } = require('discord.js');
const logger = require('../utils/logger');
const N8NClient = require('../utils/n8n-client');
const { hasPermission } = require('../utils/permissions');
const config = require('../config/config');

const n8nClient = new N8NClient(
  config.config.n8n.workflowUrl,
  config.config.n8n.apiKey
);

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignore bot messages
    if (message.author.bot) return;

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

        // Send to n8n workflow
        logger.info('📤 Sending message to n8n', {
          userId: message.author.id,
          userName: message.author.username
        });

        // Show typing indicator - will repeat every 5 seconds
        await message.channel.sendTyping();
        const typingInterval = setInterval(async () => {
          try {
            await message.channel.sendTyping();
          } catch (error) {
            clearInterval(typingInterval);
          }
        }, 5000);

        const result = await n8nClient.sendMessage(
          message.author.id,
          message.author.username,
          message.content,
          config.config.discord.serverId
        );

        // Stop typing indicator
        clearInterval(typingInterval);

        if (result.success) {
          const response = result.data?.response || 'Your message has been processed.';
          
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
          await message.reply({
            content: '❌ Error processing your message. Please try again later.'
          });
          logger.error('❌ n8n workflow error', { 
            userId: message.author.id,
            error: result.error 
          });
        }
      } catch (error) {
        logger.error('❌ Error handling DM', { 
          userId: message.author.id,
          error: error.message 
        });
        await message.reply({
          content: '❌ An error occurred while processing your message.'
        });
      }
    }
  }
};
