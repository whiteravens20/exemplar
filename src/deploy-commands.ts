import { REST, Routes } from 'discord.js';
import logger from './utils/logger.js';
import configManager from './config/config.js';
import type { SlashCommand } from './types/discord.js';

// Import slash commands
import banCommand from './slashcommands/ban.js';
import kickCommand from './slashcommands/kick.js';
import muteCommand from './slashcommands/mute.js';
import warnCommand from './slashcommands/warn.js';

async function deployCommands(): Promise<void> {
  const slashCommands: SlashCommand[] = [
    banCommand,
    kickCommand,
    muteCommand,
    warnCommand,
  ];

  const commands: unknown[] = [];

  logger.info(`Found ${slashCommands.length} command files`);

  for (const command of slashCommands) {
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      logger.info(`Loaded command: ${command.data.name}`);
    } else {
      logger.warn('A command is missing a required "data" or "execute" property.');
    }
  }

  const rest = new REST().setToken(configManager.config.discord.token);

  try {
    logger.info(`Registering ${commands.length} application (/) commands...`);

    const data = (await rest.put(
      Routes.applicationCommands(configManager.config.discord.clientId),
      { body: commands }
    )) as unknown[];

    logger.info(
      `✅ Successfully registered ${data.length} application commands`
    );
  } catch (error) {
    logger.error('Error registering commands:', {
      error: (error as Error).message,
    });
    throw error;
  }
}

export { deployCommands };
