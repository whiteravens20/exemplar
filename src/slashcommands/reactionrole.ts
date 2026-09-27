import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type Message,
  type Role,
} from 'discord.js';
import type { SlashCommand } from '../types/discord.js';
import type { ReactionRoleRow } from '../types/database.js';
import db from '../db/connection.js';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import reactionRoles from '../utils/reaction-role-manager.js';
import {
  REACTION_COMMANDS,
  parseEmoji,
  parseMessageRef,
  parseRoleRef,
  reactionEmojiKey,
  roleProblem,
  type MessageRef,
  type ParsedEmoji,
} from '../utils/reaction-roles.js';
import { withAppAvailability, resolveGuildInvoker } from './shared.js';

const MAX_CHOICES = 25;
// Embed descriptions hold 4096 characters; leave room for the "and N more" line.
const LIST_BUDGET = 3900;

type Manager =
  | { ok: true; guild: Guild; invoker: GuildMember }
  | { ok: false; error: string };

/** The configured guild and the invoker, who must hold Manage Roles there. */
async function resolveManager(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction
): Promise<Manager> {
  const base = await resolveGuildInvoker(interaction);
  if (!base.ok) return base;
  if (!base.invoker.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { ok: false, error: t('commands.reactionrole.missingPermission') };
  }
  return base;
}

async function fetchMessage(guild: Guild, ref: MessageRef): Promise<Message | null> {
  // Fetching through the guild rejects channels that belong to another server.
  const channel = await guild.channels.fetch(ref.channelId).catch(() => null);
  if (!channel?.isTextBased()) return null;
  return channel.messages.fetch(ref.messageId).catch(() => null);
}

/** Resolve a role by ID, mention or exact (case-insensitive) unique name. */
function resolveRole(guild: Guild, input: string): Role | null {
  const id = parseRoleRef(input);
  if (id) return guild.roles.cache.get(id) ?? null;
  const name = input.trim().replace(/^@/, '').toLowerCase();
  const matches = guild.roles.cache.filter((role) => role.name.toLowerCase() === name);
  return matches.size === 1 ? (matches.first() ?? null) : null;
}

/** What a binding does, as shown to admins: `@role` or `/command`. */
function targetLabel(guild: Guild, row: ReactionRoleRow): string {
  if (row.command !== null) return `/${row.command}`;
  const role = row.role_id === null ? undefined : guild.roles.cache.get(row.role_id);
  return `@${role?.name ?? t('commands.reactionrole.deletedRole')}`;
}

/** Custom emoji don't render in autocomplete choices; show them as `:name:`. */
function plainEmoji(display: string): string {
  const custom = display.match(/^<a?:(\w+):\d+>$/);
  return custom ? `:${custom[1]}:` : display;
}

function messageLink(row: ReactionRoleRow): string {
  return `https://discord.com/channels/${row.guild_id}/${row.channel_id}/${row.message_id}`;
}

/** Take the bot's own reaction off once no binding uses that emoji any more. */
async function removeOwnReaction(guild: Guild, row: ReactionRoleRow): Promise<void> {
  if (reactionRoles.match(row.message_id, row.emoji_key).length > 0) return;
  try {
    const message = await fetchMessage(guild, {
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id,
    });
    const reaction = message?.reactions.cache.find(
      (r) => reactionEmojiKey(r.emoji) === row.emoji_key
    );
    await reaction?.users.remove(guild.client.user.id);
  } catch (error) {
    logger.warn('Could not remove the bot reaction of an unbound reaction role', {
      bindingId: row.id,
      error: (error as Error).message,
    });
  }
}

type Target = { role: Role; command: null } | { role: null; command: string };

/** Check the `add` options; returns what they resolve to, or the error text. */
async function validateAdd(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  invoker: GuildMember
): Promise<string | { ref: MessageRef; emoji: ParsedEmoji; target: Target }> {
  const ref = parseMessageRef(interaction.options.getString('message', true));
  if (!ref) return t('commands.reactionrole.invalidMessage');
  if (ref.guildId && ref.guildId !== guild.id) {
    return t('commands.reactionrole.wrongServer');
  }
  const emoji = parseEmoji(interaction.options.getString('emoji', true));
  if (!emoji) return t('commands.reactionrole.invalidEmoji');

  const roleInput = interaction.options.getString('role');
  const command = interaction.options.getString('command');
  if ((roleInput === null) === (command === null)) {
    return t('commands.reactionrole.targetRequired');
  }
  if (command !== null) return { ref, emoji, target: { role: null, command } };

  const role = resolveRole(guild, roleInput ?? '');
  if (!role) return t('commands.reactionrole.roleNotFound');

  const bot = guild.members.me ?? (await guild.members.fetchMe());
  const problem = roleProblem(role, bot, invoker);
  if (problem) {
    return t(`commands.reactionrole.roleProblem.${problem}`, { role: role.name });
  }
  return { ref, emoji, target: { role, command: null } };
}

async function add(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  invoker: GuildMember
): Promise<void> {
  const checked = await validateAdd(interaction, guild, invoker);
  if (typeof checked === 'string') {
    await interaction.reply({ content: checked, flags: MessageFlags.Ephemeral });
    return;
  }
  const { ref, emoji, target } = checked;

  await interaction.deferReply();
  const message = await fetchMessage(guild, ref);
  if (!message) {
    await interaction.editReply(t('commands.reactionrole.messageNotFound'));
    return;
  }

  // Reacting proves the emoji is usable here and gives members a button to click.
  let reaction;
  try {
    reaction = await message.react(emoji.react);
  } catch (error) {
    await interaction.editReply(
      t('commands.reactionrole.emojiUnusable', { error: (error as Error).message })
    );
    return;
  }

  const row = await reactionRoles.bind({
    guild_id: guild.id,
    channel_id: message.channelId,
    message_id: message.id,
    // The key as reaction events will report it, not as it was typed.
    emoji_key: reactionEmojiKey(reaction.emoji) ?? emoji.key,
    emoji_display: reaction.emoji.toString(),
    role_id: target.role?.id ?? null,
    command: target.command,
    created_by: interaction.user.id,
  });
  if (!row) {
    await interaction.editReply(t('commands.reactionrole.alreadyBound'));
    return;
  }
  await interaction.editReply(
    target.role
      ? t('commands.reactionrole.added', {
          id: row.id,
          emoji: row.emoji_display,
          role: target.role.name,
          link: message.url,
        })
      : t('commands.reactionrole.addedCommand', {
          id: row.id,
          emoji: row.emoji_display,
          command: target.command,
          link: message.url,
        })
  );
}

async function remove(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const id = interaction.options.getInteger('id', true);
  // Only bindings of the configured server are in memory; others are not ours to delete.
  const row = reactionRoles.binding(id)
    ? await reactionRoles.unbind(id, interaction.user.id)
    : null;
  if (!row) {
    await interaction.reply({
      content: t('commands.reactionrole.notFound', { id }),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await removeOwnReaction(guild, row);
  await interaction.reply(
    t('commands.reactionrole.removed', {
      id: row.id,
      emoji: row.emoji_display,
      target: targetLabel(guild, row),
    })
  );
}

async function list(
  interaction: ChatInputCommandInteraction,
  guild: Guild
): Promise<void> {
  const filter = interaction.options.getString('message');
  const ref = filter === null ? null : parseMessageRef(filter);
  if (filter !== null && !ref) {
    await interaction.reply({
      content: t('commands.reactionrole.invalidMessage'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const rows = reactionRoles.bindings(ref?.messageId);
  if (rows.length === 0) {
    await interaction.reply(t('commands.reactionrole.listEmpty'));
    return;
  }

  // One block per message: its link, then its bindings.
  const blocks = new Map<string, string[]>();
  for (const row of rows) {
    const lines = blocks.get(row.message_id) ?? [messageLink(row)];
    lines.push(`\`#${row.id}\` ${row.emoji_display} → **${targetLabel(guild, row)}**`);
    blocks.set(row.message_id, lines);
  }

  let description = '';
  let shown = 0;
  for (const lines of blocks.values()) {
    const block = lines.join('\n');
    if (description.length + block.length + 2 > LIST_BUDGET) break;
    description += (description ? '\n\n' : '') + block;
    shown += lines.length - 1;
  }
  if (shown < rows.length) {
    description += `\n\n${t('commands.reactionrole.listMore', { count: rows.length - shown })}`;
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(t('commands.reactionrole.listTitle'))
        .setDescription(description),
    ],
  });
}

const command: SlashCommand = {
  data: withAppAvailability(
    new SlashCommandBuilder()
      .setName('reactionrole')
      .setDescription(t('commands.reactionrole.description'))
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription(t('commands.reactionrole.subcommands.add'))
          .addStringOption((option) =>
            option
              .setName('message')
              .setDescription(t('commands.reactionrole.options.message'))
              .setMaxLength(200)
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('emoji')
              .setDescription(t('commands.reactionrole.options.emoji'))
              .setMaxLength(100)
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('role')
              .setDescription(t('commands.reactionrole.options.role'))
              .setMaxLength(100)
              .setAutocomplete(true)
          )
          .addStringOption((option) =>
            option
              .setName('command')
              .setDescription(t('commands.reactionrole.options.command'))
              .addChoices(REACTION_COMMANDS.map((name) => ({ name: `/${name}`, value: name })))
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription(t('commands.reactionrole.subcommands.remove'))
          .addIntegerOption((option) =>
            option
              .setName('id')
              .setDescription(t('commands.reactionrole.options.id'))
              .setMinValue(1)
              .setAutocomplete(true)
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('list')
          .setDescription(t('commands.reactionrole.subcommands.list'))
          .addStringOption((option) =>
            option
              .setName('message')
              .setDescription(t('commands.reactionrole.options.filter'))
              .setMaxLength(200)
          )
      )
  ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const access = await resolveManager(interaction);
    if (!access.ok) {
      await interaction.reply({ content: access.error, flags: MessageFlags.Ephemeral });
      return;
    }
    if (!db.isAvailable()) {
      await interaction.reply({
        content: t('commands.reactionrole.databaseUnavailable'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    switch (interaction.options.getSubcommand()) {
      case 'add':
        return add(interaction, access.guild, access.invoker);
      case 'remove':
        return remove(interaction, access.guild);
      default:
        return list(interaction, access.guild);
    }
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const access = await resolveManager(interaction);
    if (!access.ok) {
      await interaction.respond([]);
      return;
    }
    const { guild, invoker } = access;
    const focused = interaction.options.getFocused(true);
    const query = String(focused.value).trim().replace(/^[@#]/, '').toLowerCase();

    if (focused.name === 'role') {
      // Offer only roles this admin may bind and the bot can hand out.
      const bot = guild.members.me ?? (await guild.members.fetchMe());
      const choices = [...guild.roles.cache.values()]
        .filter(
          (role) =>
            role.name.toLowerCase().includes(query) &&
            roleProblem(role, bot, invoker) === null
        )
        .sort((a, b) => b.position - a.position)
        .slice(0, MAX_CHOICES)
        .map((role) => ({ name: `@${role.name}`.slice(0, 100), value: role.id }));
      await interaction.respond(choices);
      return;
    }

    const choices = reactionRoles
      .bindings()
      .map((row) => ({
        name: `#${row.id} ${plainEmoji(row.emoji_display)} → ${targetLabel(guild, row)}`.slice(0, 100),
        value: row.id,
      }))
      .filter((choice) => choice.name.toLowerCase().includes(query))
      .slice(0, MAX_CHOICES);
    await interaction.respond(choices);
  },
};

export default command;
