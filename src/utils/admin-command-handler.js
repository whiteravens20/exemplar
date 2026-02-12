const logger = require('./logger');
const { isModeratorOrAdmin } = require('./permissions');
const conversationRepo = require('../db/repositories/conversation-repository');
const analyticsRepo = require('../db/repositories/analytics-repository');
const db = require('../db/connection');
const { EmbedBuilder } = require('discord.js');

/**
 * Format statistics data into Discord embed
 */
function formatStatsEmbed(stats, days) {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('📊 Bot Statistics')
    .setFooter({ text: `Statistics for the last ${days} days` })
    .setTimestamp();

  // Overview
  embed.addFields({
    name: '📈 Overview',
    value: `**Total Messages:** ${stats.total_messages?.toLocaleString() || 0}\n**Unique Users:** ${stats.unique_users?.toLocaleString() || 0}\n**Avg Response Time:** ${stats.avg_response_time_ms?.toFixed(0) || 0}ms`,
    inline: false
  });

  // Message types
  if (stats.messages_by_type && typeof stats.messages_by_type === 'object') {
    const types = Object.entries(stats.messages_by_type)
      .map(([type, count]) => `**${type}:** ${count}`)
      .join('\n') || 'No data';
    
    embed.addFields({
      name: '📝 By Type',
      value: types,
      inline: true
    });
  }

  // Top users
  if (Array.isArray(stats.top_users) && stats.top_users.length > 0) {
    const topUsersText = stats.top_users
      .slice(0, 5)
      .map((user, idx) => `${idx + 1}. ${user.username || user.userId} (${user.count})`)
      .join('\n');
    
    embed.addFields({
      name: '👥 Top Users',
      value: topUsersText,
      inline: true
    });
  }

  // Peak hours
  if (stats.peak_hours && typeof stats.peak_hours === 'object') {
    const hours = Object.entries(stats.peak_hours)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => `**${hour}:00** - ${count} msgs`)
      .join('\n') || 'No data';
    
    embed.addFields({
      name: '⏰ Peak Hours',
      value: hours,
      inline: false
    });
  }

  // Top commands
  if (Array.isArray(stats.top_commands) && stats.top_commands.length > 0) {
    const commandsText = stats.top_commands
      .slice(0, 5)
      .map((cmd, idx) => `${idx + 1}. /${cmd.command} (${cmd.count})`)
      .join('\n');
    
    embed.addFields({
      name: '🔧 Top Commands',
      value: commandsText,
      inline: false
    });
  }

  return embed;
}

/**
 * Handle admin commands
 * @param {string} command - Command name
 * @param {Message} message - Discord message object
 * @param {Array} args - Command arguments
 */
async function handleAdminCommand(command, message, args = []) {
  try {
    const content = message.content.trim();
    const parts = content.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const cmdArgs = parts.slice(1);

    logger.info('Admin command received', {
      userId: message.author.id,
      command: cmd,
      args: cmdArgs
    });

    // Handle !flushmemory - available to all users
    if (cmd === '!flushmemory') {
      const deletedCount = await conversationRepo.flushUserConversations(message.author.id);
      
      await analyticsRepo.logCommand(
        message.author.id,
        message.author.username,
        'flushmemory',
        true,
        true
      ).catch(err => logger.error('Failed to log command', { error: err.message }));

      await message.reply({
        content: `✅ Twoja pamięć konwersacji została wyczyszczona (${deletedCount} wiadomości usuniętych).`
      });
      
      logger.info('User flushed their conversation memory', {
        userId: message.author.id,
        deletedCount
      });
      return;
    }

    // Get member for permission checking (for admin-only commands)
    const serverId = require('../config/config').config.discord.serverId;
    const guild = message.client.guilds.cache.get(serverId);
    
    if (!guild) {
      await message.reply({
        content: '❌ Nie można zweryfikować uprawnień - serwer niedostępny.'
      });
      return;
    }

    const member = await guild.members.fetch(message.author.id).catch(() => null);
    
    if (!member) {
      await message.reply({
        content: '❌ Nie jesteś członkiem skonfigurowanego serwera.'
      });
      return;
    }

    // Check admin permissions for admin-only commands
    if (!isModeratorOrAdmin(member)) {
      await analyticsRepo.logCommand(
        message.author.id,
        message.author.username,
        cmd.substring(1), // Remove ! prefix
        true,
        false
      ).catch(err => logger.error('Failed to log command', { error: err.message }));

      await message.reply({
        content: '❌ Nie masz uprawnień do użycia tej komendy. Wymagane uprawnienia: Administrator lub Moderator.'
      });
      
      logger.warn('Unauthorized admin command attempt', {
        userId: message.author.id,
        command: cmd
      });
      return;
    }

    // Handle admin commands
    switch (cmd) {
      case '!flushdb':
        if (!db.isAvailable()) {
          await message.reply({
            content: '❌ Baza danych niedostępna. Nie można wykonać operacji.'
          });
          return;
        }

        // Confirmation required
        await message.reply({
          content: '⚠️ **UWAGA:** Ta operacja usunie wszystkie konwersacje, rate limity i statystyki z bazy danych!\n\nCzy na pewno chcesz kontynuować? Wpisz `!flushdb confirm` aby potwierdzić.'
        });

        if (cmdArgs[0] !== 'confirm') {
          return;
        }

        // Flush all tables except users and warnings
        await conversationRepo.flushAllConversations();
        await db.query('TRUNCATE rate_limits, message_stats, command_usage');

        await analyticsRepo.logCommand(
          message.author.id,
          message.author.username,
          'flushdb',
          true,
          true
        ).catch(err => logger.error('Failed to log command', { error: err.message }));

        await message.reply({
          content: '✅ Baza danych została wyczyszczona (zachowano użytkowników i ostrzeżenia).'
        });

        logger.warn('Database flushed by admin', {
          adminId: message.author.id,
          adminUsername: message.author.username
        });
        break;

      case '!stats':
        if (!db.isAvailable()) {
          await message.reply({
            content: '❌ Baza danych niedostępna. Nie można pobrać statystyk.'
          });
          return;
        }

        const days = parseInt(cmdArgs[0]) || 7;
        
        if (days < 1 || days > 90) {
          await message.reply({
            content: '❌ Nieprawidłowa liczba dni. Podaj wartość od 1 do 90.'
          });
          return;
        }

        const stats = await analyticsRepo.getGlobalStats(days);

        if (!stats) {
          await message.reply({
            content: '❌ Nie udało się pobrać statystyk. Spróbuj ponownie później.'
          });
          return;
        }

        const embed = formatStatsEmbed(stats, days);

        await analyticsRepo.logCommand(
          message.author.id,
          message.author.username,
          'stats',
          true,
          true
        ).catch(err => logger.error('Failed to log command', { error: err.message }));

        await message.reply({ embeds: [embed] });

        logger.info('Admin viewed stats', {
          adminId: message.author.id,
          days
        });
        break;

      default:
        await message.reply({
          content: `❌ Nieznana komenda: ${cmd}\n\nDostępne komendy admin:\n• \`!flushdb confirm\` - Wyczyść bazę danych\n• \`!stats [days]\` - Pokaż statystyki (domyślnie 7 dni)\n• \`!flushmemory\` - Wyczyść własną pamięć konwersacji (dostępne dla wszystkich)`
        });
    }
  } catch (error) {
    logger.error('Error handling admin command', {
      error: error.message,
      stack: error.stack,
      command,
      userId: message.author.id
    });

    await message.reply({
      content: '❌ Wystąpił błąd podczas wykonywania komendy. Sprawdź logi.'
    });
  }
}

module.exports = {
  handleAdminCommand,
  formatStatsEmbed
};
