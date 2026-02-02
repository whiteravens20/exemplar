const statuses = [
  {
    name: '/help for commands',
    type: 'LISTENING'
  },
  {
    name: 'Discord messages',
    type: 'WATCHING'
  },
  {
    name: 'DMs for AI chat',
    type: 'LISTENING'
  },
  {
    name: 'server activity',
    type: 'WATCHING'
  }
];

function getRandomStatus() {
  return statuses[Math.floor(Math.random() * statuses.length)];
}

module.exports = {
  statuses,
  getRandomStatus
};
