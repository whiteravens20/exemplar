import logger from './logger.js';
import type { Message, ChatInputCommandInteraction } from 'discord.js';

class ErrorHandler {
  static async handleCommandError(
    interaction: ChatInputCommandInteraction,
    error: Error
  ): Promise<void> {
    logger.error('Command execution error', {
      command: interaction.commandName,
      userId: interaction.user.id,
      error: error.message,
      stack: error.stack,
    });

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: '❌ An error occurred while executing this command.',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while executing this command.',
          ephemeral: true,
        });
      }
    } catch (err) {
      logger.error('Failed to send error response', {
        error: (err as Error).message,
      });
    }
  }

  static async handleMessageError(
    message: Message,
    error: Error
  ): Promise<void> {
    logger.error('Message handling error', {
      userId: message.author.id,
      username: message.author.username,
      error: error.message,
      stack: error.stack,
    });

    try {
      await message.reply({
        content: '❌ An error occurred while processing your message.',
      });
    } catch (err) {
      logger.error('Failed to send error response', {
        error: (err as Error).message,
      });
    }
  }

  static logUnhandledError(error: Error): void {
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
    });
  }
}

export default ErrorHandler;
