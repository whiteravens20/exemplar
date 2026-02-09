const { ActivityType } = require('discord.js');

const statuses = [
  {
    name: '/help for commands',
    type: ActivityType.Listening
  },
  {
    name: 'Discord messages',
    type: ActivityType.Watching
  },
  {
    name: 'DMs for AI chat',
    type: ActivityType.Listening
  },
  {
    name: 'server activity',
    type: ActivityType.Watching
  },
  {
    name: 'your messages',
    type: ActivityType.Watching
  }
];

function getRandomStatus() {
  return statuses[Math.floor(Math.random() * statuses.length)];
}

module.exports = {
  statuses,
  getRandomStatus
};
