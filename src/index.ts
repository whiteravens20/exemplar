import 'dotenv/config';

import {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  Partials,
} from 'discord.js';
import logger from './utils/logger.js';
import configManager from './config/config.js';
import db from './db/connection.js';
import HealthCheckServer from './api/server.js';
import cleanupJob from './jobs/database-cleanup.js';
import type { SlashCommand } from './types/discord.js';

// Import events
import errorEvent from './events/error.js';
import readyEvent from './events/ready.js';
import interactionCreateEvent from './events/interactionCreate.js';
import messageCreateEvent from './events/messageCreate.js';

// Import slash commands
import banCommand from './slashcommands/ban.js';
import kickCommand from './slashcommands/kick.js';
import muteCommand from './slashcommands/mute.js';
import warnCommand from './slashcommands/warn.js';

// Validate configuration
if (!configManager.validateRequiredConfig()) {
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
    GatewayIntentBits.GuildModeration,
  ],
  partials: [
    Partials.Channel, // Required for DM support
    Partials.Message, // Required for uncached messages
  ],
});

client.commands = new Collection<string, SlashCommand>();

// Register slash commands statically (no dynamic require)
const slashCommands: SlashCommand[] = [
  banCommand,
  kickCommand,
  muteCommand,
  warnCommand,
];

const commandsJson: unknown[] = [];
for (const command of slashCommands) {
  client.commands.set(command.data.name, command);
  commandsJson.push(command.data.toJSON());
  logger.info(`Loaded command: ${command.data.name}`);
}

// Register events statically
const events = [errorEvent, readyEvent, interactionCreateEvent, messageCreateEvent];

for (const event of events) {
  if (event.once) {
    client.once(event.name, (...args: unknown[]) => event.execute(...args));
  } else {
    client.on(event.name, (...args: unknown[]) => event.execute(...args));
  }
  logger.info(`Loaded event: ${event.name}`);
}

// Register slash commands with Discord API
async function registerCommands(): Promise<void> {
  try {
    logger.info('Registering slash commands...');

    const rest = new REST().setToken(configManager.config.discord.token);

    await rest.put(
      Routes.applicationCommands(configManager.config.discord.clientId),
      { body: commandsJson }
    );

    logger.info(
      `✅ Successfully registered ${commandsJson.length} slash commands`
    );
  } catch (error) {
    logger.error('Error registering commands', {
      error: (error as Error).message,
    });
  }
}

// Health check server reference for graceful shutdown
let healthServer: HealthCheckServer | null = null;

// Login to Discord
async function start(): Promise<void> {
  try {
    logger.info('🤖 Starting Discord bot...');

    // Initialize database connection
    logger.info('Connecting to database...');
    await db.initialize();

    // Start health check server
    const healthPort = configManager.config.health.port;
    healthServer = new HealthCheckServer(healthPort);
    await healthServer.start();

    // Start database cleanup job
    cleanupJob.start();

    await registerCommands();
    await client.login(configManager.config.discord.token);
  } catch (error) {
    logger.error('Failed to start bot', {
      error: (error as Error).message,
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down bot...');

  // Stop cleanup job
  cleanupJob.stop();

  // Stop health check server
  if (healthServer) await healthServer.stop();

  // Close database connection
  await db.close();

  // Destroy Discord client
  await client.destroy();

  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down...');

  cleanupJob.stop();
  if (healthServer) await healthServer.stop();
  await db.close();
  await client.destroy();

  process.exit(0);
});

// Error handlers
process.on('unhandledRejection', (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled promise rejection', {
    error: error.message,
    stack: error.stack,
  });
});

process.on('uncaughtException', (error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('Uncaught exception', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

// Discord.js warnings
client.on('warn', (info: string) => {
  logger.warn('Discord client warning', { info });
});

client.on('debug', (info: string) => {
  // Only log important debug info
  if (info.includes('Heartbeat') || info.includes('Session')) {
    logger.debug(info);
  }
});

start();
