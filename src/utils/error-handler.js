const logger = require('./logger');

class ErrorHandler {
  static async handleCommandError(interaction, error) {
    logger.error('Command execution error', {
      command: interaction.commandName,
      userId: interaction.user.id,
      error: error.message,
      stack: error.stack
    });

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: '❌ An error occurred while executing this command.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while executing this command.',
          ephemeral: true
        });
      }
    } catch (err) {
      logger.error('Failed to send error response', { error: err.message });
    }
  }

  static async handleMessageError(message, error) {
    logger.error('Message handling error', {
      userId: message.author.id,
      username: message.author.username,
      error: error.message,
      stack: error.stack
    });

    try {
      await message.reply({
        content: '❌ An error occurred while processing your message.'
      });
    } catch (err) {
      logger.error('Failed to send error response', { error: err.message });
    }
  }

  static logUnhandledError(error) {
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack
    });
  }
}

module.exports = ErrorHandler;
