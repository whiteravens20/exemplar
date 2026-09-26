import type {
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
}

// Extend Discord.js Client to include commands collection
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, SlashCommand>;
  }
}

export type { Client, Message, ChatInputCommandInteraction };
