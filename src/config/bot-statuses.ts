import { ActivityType } from 'discord.js';

interface BotStatus {
  name: string;
  type: ActivityType;
}

const statuses: BotStatus[] = [
  {
    name: 'DM !help dla komend',
    type: ActivityType.Listening,
  },
  {
    name: 'obserwuję wiadomości Discord',
    type: ActivityType.Watching,
  },
  {
    name: 'DM dla czatu z AI',
    type: ActivityType.Listening,
  },
  {
    name: 'sprawdzam aktywność serwera',
    type: ActivityType.Watching,
  },
  {
    name: 'monitoruję wiadomości w Imperium',
    type: ActivityType.Watching,
  },
];

function getRandomStatus(): BotStatus {
  return statuses[Math.floor(Math.random() * statuses.length)];
}

export { statuses, getRandomStatus };
export type { BotStatus };
