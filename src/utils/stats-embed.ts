import { EmbedBuilder } from 'discord.js';
import type { GlobalStats } from '../types/database.js';

interface TopUser {
  username?: string;
  userId?: string;
  count: string | number;
}

interface TopCommand {
  command: string;
  count: string | number;
}

export interface StatsData
  extends Omit<
    GlobalStats,
    'messages_by_type' | 'top_users' | 'peak_hours' | 'top_commands'
  > {
  messages_by_type?: Record<string, string | number>;
  top_users?: TopUser[];
  peak_hours?: Record<string, string | number>;
  top_commands?: TopCommand[];
}

/** Format global statistics data into a Discord embed. */
export function formatStatsEmbed(stats: StatsData, days: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('📊 Bot Statistics')
    .setFooter({ text: `Statistics for the last ${days} days` })
    .setTimestamp();

  // Convert numeric values from PostgreSQL (they come as strings)
  const totalMessages = parseInt(String(stats.total_messages)) || 0;
  const uniqueUsers = parseInt(String(stats.unique_users)) || 0;
  const avgResponseTime = parseFloat(String(stats.avg_response_time_ms)) || 0;

  embed.addFields({
    name: '📈 Overview',
    value: `**Total Messages:** ${totalMessages.toLocaleString()}\n**Unique Users:** ${uniqueUsers.toLocaleString()}\n**Avg Response Time:** ${avgResponseTime.toFixed(0)}ms`,
    inline: false,
  });

  if (stats.messages_by_type && typeof stats.messages_by_type === 'object') {
    const types =
      Object.entries(stats.messages_by_type)
        .map(([type, count]) => `**${type}:** ${parseInt(String(count)) || 0}`)
        .join('\n') || 'No data';
    embed.addFields({ name: '📝 By Type', value: types, inline: true });
  }

  if (Array.isArray(stats.top_users) && stats.top_users.length > 0) {
    const topUsersText = stats.top_users
      .slice(0, 5)
      .map(
        (user: TopUser, idx: number) =>
          `${idx + 1}. ${user.username || user.userId} (${parseInt(String(user.count)) || 0})`
      )
      .join('\n');
    embed.addFields({ name: '👥 Top Users', value: topUsersText, inline: true });
  }

  if (stats.peak_hours && typeof stats.peak_hours === 'object') {
    const hours =
      Object.entries(stats.peak_hours)
        .sort(
          (a, b) => (parseInt(String(b[1])) || 0) - (parseInt(String(a[1])) || 0)
        )
        .slice(0, 3)
        .map(
          ([hour, count]) => `**${hour}:00** - ${parseInt(String(count)) || 0} msgs`
        )
        .join('\n') || 'No data';
    embed.addFields({ name: '⏰ Peak Hours', value: hours, inline: false });
  }

  if (Array.isArray(stats.top_commands) && stats.top_commands.length > 0) {
    const commandsText = stats.top_commands
      .slice(0, 5)
      .map(
        (cmd: TopCommand, idx: number) =>
          `${idx + 1}. /${cmd.command} (${parseInt(String(cmd.count)) || 0})`
      )
      .join('\n');
    embed.addFields({
      name: '🔧 Top Commands',
      value: commandsText,
      inline: false,
    });
  }

  return embed;
}
