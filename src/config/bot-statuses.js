const { ActivityType } = require('discord.js');

const statuses = [
  {
    name: 'DM /help dla komend',
    type: ActivityType.Listening
  },
  {
    name: 'obserwuję wiadomości Discord',
    type: ActivityType.Watching
  },
  {
    name: 'DM dla czatu z AI',
    type: ActivityType.Listening
  },
  {
    name: 'sprawdzam aktywność serwera',
    type: ActivityType.Watching
  },
  {
    name: 'monitoruję wiadomości w imperium',
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
