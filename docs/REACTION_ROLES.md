# Reaction roles

Members pick their own roles by reacting to a message. An admin binds
**message + emoji → role**; reacting grants the role, removing the reaction
revokes it. A binding can run a bot command instead: reacting then gets the
member the command's reply in DM (see [Command bindings](#command-bindings)).

> Implements [issue #24](https://github.com/whiteravens20/exemplar/issues/24).

## Requirements

- **Database.** Bindings are stored in PostgreSQL (`reaction_roles`, migration
  `006`). Without a database `/reactionrole` answers that it is unavailable.
- **Bot permissions** in the channels holding the role messages: View Channel,
  Read Message History, Add Reactions. On the server: **Manage Roles**.
- **Role order.** The bot can only hand out roles *below its own highest role*.
  In *Server Settings → Roles*, drag the bot's role above every role it should
  grant.

The reaction events use the `GuildMessageReactions` gateway intent. It is not a
privileged intent, so there is nothing to switch on in the Developer Portal.

## Commands

Like every other command, `/reactionrole` runs in the DMs with the bot and acts
on `DISCORD_SERVER_ID`. It needs **Manage Roles** on that server.

| Command | What it does |
|---|---|
| `/reactionrole add <message> <emoji> <role>` | Bind a reaction on a message to a role |
| `/reactionrole add <message> <emoji> command:<command>` | Bind a reaction to a command whose reply is DMed |
| `/reactionrole list [message]` | Show the bindings, all or for one message |
| `/reactionrole remove <id>` | Delete a binding by the ID `list` shows |

### `add`

- **message**: the message link (right-click the message → *Copy Message
  Link*). A `channelId-messageId` pair also works; that is what *Copy Message
  ID* gives with Shift held. The message must be on the configured server.
- **emoji**: a Unicode emoji (`🎮`) or a custom emoji as `<:name:id>`,
  `name:id` or its ID. Custom emoji have to come from a server the bot is in.
- **role**: start typing and pick from the list. The list only offers roles
  you may bind. A role ID, a `<@&id>` mention or the exact role name also work.
- **command**: instead of a role, a command from the list. Give either `role`
  or `command`, not both.

The bot then reacts to the message with the emoji. This checks that the emoji
can be used there, and gives members a reaction to click. If the reaction fails,
for example because of an unknown emoji, missing Add Reactions, or a message
that already has 20 different reactions, no binding is created and the reply
gives Discord's error.

A role binding is refused when the role is `@everyone`, is managed by an integration
(bot roles, booster role), or is at or above the bot's highest role or the
admin's own. The server owner is exempt from the last check.

### `remove`

Deletes the binding. Members who already have the role keep it. When no
binding on that message uses the emoji any more, the bot removes its own
reaction.

## Combinations

Every binding is a separate `(message, emoji, role)` triple, so any mix works:

| Setup | Example |
|---|---|
| One message, one emoji, one role | `#roles`: 🎮 → @Gamer |
| One message, several emoji, several roles | `#roles`: 🎮 → @Gamer, 🎨 → @Artist |
| Same emoji on different messages, different roles | 🇵🇱 on *language* → @Polish, 🇵🇱 on *events* → @PL-events |
| Same role from several messages or emoji | ✅ on *rules* → @Member, 👋 on *welcome* → @Member |
| One reaction, several roles | Bind the same message + emoji twice with different roles |
| Role and command on one message | `#welcome`: ✅ → @Member, 📜 → `/rules` |

Unicode emoji match with or without the variation selector, so `❤` and `❤️`
are the same binding.

## Command bindings

A command binding makes the bot DM the reply of a command to whoever adds the
reaction, as if they had run it in their DMs with the bot. The reply follows
that member's own access: `/help` lists the commands they can use, and members
outside `ALLOWED_ROLES_FOR_AI` get the no-permission reply.

| Command | Reply |
|---|---|
| `/help` | The command list |
| `/rules` | The server rules (`RULES_TEXT`) |

- Removing the reaction does nothing.
- One member gets one reply per binding every 30 seconds. Removing and re-adding
  the reaction within that time does not send another.
- Members who do not accept DMs from server members get nothing. The bot logs a
  warning.

Only commands without options can be bound. A command is added to the list by
implementing `reactionReply` in its module and naming it in
`REACTION_COMMANDS` (`src/utils/reaction-roles.ts`).

## Behaviour

- **Add.** Reacting grants every role bound to that message + emoji the member
  lacks.
- **Remove.** Removing the reaction revokes every role bound to it that the
  member has. A role reachable from several reactions is revoked when *any* of
  them is removed.
- **Order.** Each member's reaction changes are applied one at a time, in the
  order Discord sends them. A quick add → remove → add ends with the role
  granted.
- **Not reacted to:** bots (the bot's own reactions included), reactions on
  other servers, and a moderator clearing all reactions on a message. The last
  one leaves roles as they are.
- **Hierarchy.** Before each change the bot checks that it still has Manage
  Roles and that the role is still below its highest role. When a check fails,
  the change is skipped and a warning is logged.
- **Audit log.** Role changes carry a reason such as *Reaction role: reacted
  with 🎮*.

## Restarts and cleanup

Bindings live in the database and are loaded into memory at startup. Reactions
on messages sent before a restart still work: the bot handles them as partial
events and does not need those messages in its cache. A reaction on a message
with no binding is dismissed without a database query or an API call.

At startup the bot fetches each bound message once and drops bindings whose
message, channel or role no longer exists. When it cannot tell, for example
because it lost access to a channel, it keeps the binding and logs a warning.
While running, deleting a bound message or role deletes its bindings.

## Logs

Each grant, revoke, command reply, bind and unbind is logged at `info` with the
binding ID, user, role or command, message and emoji:

```
info: Reaction role granted {"bindingId":3,"userId":"...","roleId":"...","messageId":"...","emoji":"🎮"}
warn: Reaction role skipped: bot cannot manage the role {"bindingId":5,...,"problem":"botHierarchy"}
```

## Troubleshooting

| Symptom | Cause |
|---|---|
| Reacting does nothing, the log shows `problem":"botHierarchy"` | The role was moved above the bot's role. Move the bot's role up |
| Reacting does nothing, no log line | No binding for that message + emoji. Check `/reactionrole list` |
| `add` replies *I couldn't react with that emoji* | The bot lacks Add Reactions or Read Message History there, the emoji is from a server the bot is not in, or the message has 20 different reactions |
| `add` replies *Message not found* | Wrong link, or the bot cannot view that channel |
| A command binding sends nothing, the log shows `Reaction command failed` | The member does not accept DMs from server members |
