require('dotenv').config();

const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const config = require('./config/config');

// Validate configuration
if (!config.validateRequiredConfig()) {
  logger.error('❌ Configuration validation failed');
  process.exit(1);
}

// Initialize client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ]
});

client.commands = new Collection();
const commands = [];

// Load slash commands
const slashCommandsPath = path.join(__dirname, 'slashcommands');
const slashCommandFiles = fs.readdirSync(slashCommandsPath).filter(file => file.endsWith('.js'));

for (const file of slashCommandFiles) {
  const filePath = path.join(slashCommandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
    logger.info(`Loaded command: ${command.data.name}`);
  } else {
    logger.warn(`Skipping invalid command: ${file}`);
  }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  logger.info(`Loaded event: ${event.name}`);
}

// Register slash commands
async function registerCommands() {
  try {
    logger.info('Registering slash commands...');
    
    const rest = new REST().setToken(config.config.discord.token);
    
    await rest.put(
      Routes.applicationCommands(config.config.discord.clientId),
      { body: commands }
    );

    logger.info(`✅ Successfully registered ${commands.length} slash commands`);
  } catch (error) {
    logger.error('Error registering commands', { error: error.message });
  }
}

// Login to Discord
async function start() {
  try {
    logger.info('🤖 Starting Discord bot...');
    await registerCommands();
    await client.login(config.config.discord.token);
    logger.info('✅ Bot connected to Discord');
  } catch (error) {
    logger.error('Failed to start bot', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down bot...');
  await client.destroy();
  process.exit(0);
});

start();
