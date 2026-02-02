const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const config = require('./config/config');

async function deployCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'slashcommands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  logger.info(`Found ${commandFiles.length} command files`);

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      logger.info(`Loaded command: ${command.data.name}`);
    } else {
      logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }

  const rest = new REST().setToken(config.config.discord.token);

  try {
    logger.info(`Registering ${commands.length} application (/) commands...`);

    const data = await rest.put(
      Routes.applicationCommands(config.config.discord.clientId),
      { body: commands }
    );

    logger.info(`✅ Successfully registered ${data.length} application commands`);
  } catch (error) {
    logger.error('Error registering commands:', { error: error.message });
    throw error;
  }
}

module.exports = { deployCommands };
