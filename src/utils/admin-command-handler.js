const logger = require('./logger');
const { isModeratorOrAdmin } = require('./permissions');
const conversationRepo = require('../db/repositories/conversation-repository');
const analyticsRepo = require('../db/repositories/analytics-repository');
const warningRepo = require('../db/repositories/warning-repository');
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
 * @param {Message} message - Discord message object
 */
async function handleAdminCommand(message) {
  const content = message.content.trim();
  const parts = content.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const cmdArgs = parts.slice(1);

  try {
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

    // Handle !warnings - available to all users (show own) and admins (show all or specific user)
    if (cmd === '!warnings') {
      if (!db.isAvailable()) {
        await message.reply({
          content: '❌ Baza danych niedostępna. Nie można pobrać ostrzeżeń.'
        });
        return;
      }

      // Get member for permission checking
      const serverId = require('../config/config').config.discord.serverId;
      const guild = message.client.guilds.cache.get(serverId);
      const member = guild ? await guild.members.fetch(message.author.id).catch(() => null) : null;
      const isAdmin = member && isModeratorOrAdmin(member);

      let targetId = null;
      let targetUsername = null;

      // Check if admin is querying specific user
      if (isAdmin && cmdArgs.length > 0) {
        // Try to extract user mention
        const mentionMatch = cmdArgs[0].match(/^<@!?(\d+)>$/);
        if (mentionMatch) {
          targetId = mentionMatch[1];
        } else if (/^\d+$/.test(cmdArgs[0])) {
          targetId = cmdArgs[0];
        }

        // If targetId provided, try to fetch user
        if (targetId) {
          try {
            const targetUser = await message.client.users.fetch(targetId);
            targetUsername = targetUser.username;
          } catch (error) {
            await message.reply({
              content: `❌ Nie można znaleźć użytkownika o ID: ${targetId}`
            });
            logger.warn('User not found for warnings command', { targetId, error: error.message });
            return;
          }
        }
      }

      let warnings = [];
      let embedTitle = '';
      let embedDescription = '';

      if (isAdmin && !targetId) {
        // Admin viewing all warnings
        warnings = await warningRepo.getAllWarnings(false);
        embedTitle = '⚠️ Wszystkie Aktywne Ostrzeżenia';
        embedDescription = warnings.length > 0 
          ? `Znaleziono **${warnings.length}** aktywnych ostrzeżeń.`
          : 'Brak aktywnych ostrzeżeń w systemie.';
      } else if (targetId) {
        // Admin viewing specific user
        warnings = await warningRepo.getWarningHistory(targetId, false);
        embedTitle = `⚠️ Ostrzeżenia: ${targetUsername}`;
        embedDescription = warnings.length > 0
          ? `Użytkownik ma **${warnings.length}** aktywnych ostrzeżeń.`
          : 'Użytkownik nie ma aktywnych ostrzeżeń.';
      } else {
        // Regular user viewing own warnings
        warnings = await warningRepo.getWarningHistory(message.author.id, false);
        embedTitle = '⚠️ Twoje Ostrzeżenia';
        embedDescription = warnings.length > 0
          ? `Masz **${warnings.length}** aktywnych ostrzeżeń.`
          : 'Nie masz aktywnych ostrzeżeń! ✅';
      }

      // Log command usage
      await analyticsRepo.logCommand(
        message.author.id,
        message.author.username,
        'warnings',
        false,
        true
      ).catch(err => logger.error('Failed to log command', { error: err.message }));

      if (warnings.length === 0) {
        await message.reply({
          content: embedDescription
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle(embedTitle)
        .setDescription(embedDescription)
        .setTimestamp();

      // Limit to 25 warnings (Discord embed field limit)
      const displayWarnings = warnings.slice(0, 25);
      
      displayWarnings.forEach((warning, index) => {
        const expiresAt = new Date(warning.expires_at);
        const issuedAt = new Date(warning.issued_at);
        const daysLeft = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
        
        let fieldName = `Ostrzeżenie ${index + 1}`;
        if (isAdmin && !targetId) {
          // Show username when displaying all warnings
          fieldName = `${warning.username || warning.user_discord_id}`;
        }

        let fieldValue = `**Powód:** ${warning.reason}\n**Wydano:** ${issuedAt.toLocaleDateString('pl-PL')}\n**Wygasa za:** ${daysLeft} dni`;
        
        if (isAdmin && warning.issued_by_username) {
          fieldValue += `\n**Wydane przez:** ${warning.issued_by_username}`;
        }

        embed.addFields({
          name: fieldName,
          value: fieldValue,
          inline: false
        });
      });

      if (warnings.length > 25) {
        embed.setFooter({ text: `Pokazano 25 z ${warnings.length} ostrzeżeń` });
      }

      await message.reply({ embeds: [embed] });

      logger.info('User checked warnings', { 
        userId: message.author.id,
        isAdmin,
        targetId: targetId || null,
        warningCount: warnings.length 
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
      case '!warn': {
        if (!db.isAvailable()) {
          await message.reply({
            content: '❌ Baza danych niedostępna. Ostrzeżenia nie mogą być zapisane.'
          });
          return;
        }

        // Parse command: !warn @user reason or !warn userID reason
        const warnArgs = cmdArgs.join(' ').trim();
        let targetId = null;
        let reason = 'Nie podano powodu';

        // Try to extract user mention
        const mentionMatch = warnArgs.match(/^<@!?(\d+)>\s*(.*)/);
        if (mentionMatch) {
          targetId = mentionMatch[1];
          reason = mentionMatch[2] || reason;
        } else {
          // Try to parse as userID followed by reason
          const parts = warnArgs.split(/\s+/);
          if (parts.length > 0 && /^\d+$/.test(parts[0])) {
            targetId = parts[0];
            reason = parts.slice(1).join(' ') || reason;
          }
        }

        if (!targetId) {
          await message.reply({
            content: '❌ **Użycie:** `!warn <@user> [powód]` lub `!warn <userID> [powód]`\n\n**Przykład:**\n```\n!warn @JanKowalski Spam w czacie\n!warn 123456789012345678 Niewłaściwe zachowanie\n```'
          });
          return;
        }

        // Try to fetch the user
        let targetUser;
        try {
          targetUser = await message.client.users.fetch(targetId);
        } catch (error) {
          await message.reply({
            content: `❌ Nie można znaleźć użytkownika o ID: ${targetId}`
          });
          logger.warn('User not found for warn command', { targetId, error: error.message });
          return;
        }

        // Check if trying to warn bot
        if (targetUser.bot) {
          await message.reply({
            content: '❌ Nie można ostrzec bota.'
          });
          return;
        }

        // Try to send DM to the user
        let dmSent = false;
        try {
          const dm = await targetUser.createDM();
          await dm.send({
            embeds: [{
              color: 0xFFAA00,
              title: '⚠️ Ostrzeżenie',
              description: 'Otrzymałeś ostrzeżenie od moderacji',
              fields: [
                {
                  name: 'Powód',
                  value: reason
                }
              ],
              footer: {
                text: 'Kontynuowanie niewłaściwego zachowania może skutkować dalszymi sankcjami'
              },
              timestamp: new Date()
            }]
          });
          dmSent = true;
        } catch (dmError) {
          logger.warn('Could not send DM to warned user', {
            userId: targetId,
            error: dmError.message
          });
        }

        // Save warning to database
        const activeWarnings = await warningRepo.addWarning(
          targetUser.id,
          targetUser.username,
          reason,
          message.author.id
        );

        // Log admin command
        await analyticsRepo.logCommand(
          message.author.id,
          message.author.username,
          'warn',
          true,
          true
        ).catch(err => logger.error('Failed to log command', { error: err.message }));

        logger.info('User warned via admin command', {
          targetId: targetUser.id,
          targetUsername: targetUser.username,
          reason,
          issuedBy: message.author.id,
          dmSent,
          activeWarnings
        });

        const dmStatus = dmSent ? '✅' : '⚠️ (DM nie doręczono)';
        const embed = new EmbedBuilder()
          .setColor(0xFFAA00)
          .setTitle('⚠️ Ostrzeżenie Wydane')
          .addFields(
            { name: 'Użytkownik', value: `${targetUser.username} (${targetUser.id})`, inline: true },
            { name: 'Aktywne ostrzeżenia', value: `${activeWarnings}`, inline: true },
            { name: 'DM Status', value: dmStatus, inline: true },
            { name: 'Powód', value: reason }
          )
          .setTimestamp()
          .setFooter({ text: `Wydane przez ${message.author.username}` });

        await message.reply({ embeds: [embed] });
        break;
      }

      case '!flushdb': {
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
      }

      case '!stats': {
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

        const statsEmbed = formatStatsEmbed(stats, days);

        await analyticsRepo.logCommand(
          message.author.id,
          message.author.username,
          'stats',
          true,
          true
        ).catch(err => logger.error('Failed to log command', { error: err.message }));

        await message.reply({ embeds: [statsEmbed] });

        logger.info('Admin viewed stats', {
          adminId: message.author.id,
          days
        });
        break;
      }

      default:
        await message.reply({
          content: `❌ Nieznana komenda: ${cmd}\n\n**Komendy Admin:**\n• \`!warn <@user> [powód]\` - Wystaw ostrzeżenie użytkownikowi\n• \`!warnings [@user]\` - Pokaż wszystkie ostrzeżenia lub konkretnego użytkownika\n• \`!flushdb confirm\` - Wyczyść bazę danych\n• \`!stats [days]\` - Pokaż statystyki (domyślnie 7 dni)\n\n**Komendy Użytkownika:**\n• \`!flushmemory\` - Wyczyść własną pamięć konwersacji\n• \`!warnings\` - Pokaż swoje ostrzeżenia`
        });
    }
  } catch (error) {
    logger.error('Error handling admin command', {
      error: error.message,
      stack: error.stack,
      command: cmd,
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
