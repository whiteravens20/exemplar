import type {
  BaseMessageOptions,
  Client,
  Collection,
  Message,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export interface BotEvent {
  name: string;
  once?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (...args: any[]) => void | Promise<void>;
}

export interface SlashCommand {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  /** Answers autocomplete for options declared with `setAutocomplete(true)`. */
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  /**
   * The command's reply for a member who triggered it by reacting to a message
   * (a reaction-role command binding). The bot DMs it to them. Only commands
   * without options implement this.
   */
  reactionReply?: (context: CommandContext) => Promise<BaseMessageOptions>;
}

/** Who runs a command: an interaction, or the member behind a reaction. */
export type CommandContext = Pick<ChatInputCommandInteraction, 'client' | 'user'>;

// Extend Discord.js Client to include commands collection
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, SlashCommand>;
  }
}

export type { Client, Message, ChatInputCommandInteraction };
