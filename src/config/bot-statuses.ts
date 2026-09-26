import { ActivityType } from 'discord.js';
import { t } from '../utils/i18n.js';

interface BotStatus {
  name: string;
  type: ActivityType;
}

// Discord shows each name after its activity verb ("Listening to", "Watching").
const statuses = [
  { key: 'presence.helpInDm', type: ActivityType.Listening },
  { key: 'presence.discordMessages', type: ActivityType.Watching },
  { key: 'presence.aiChatInDm', type: ActivityType.Listening },
  { key: 'presence.serverActivity', type: ActivityType.Watching },
  { key: 'presence.imperium', type: ActivityType.Watching },
] as const;

function getRandomStatus(): BotStatus {
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  return { name: t(status.key), type: status.type };
}

export { statuses, getRandomStatus };
export type { BotStatus };
