-- Migration: 006 - Reaction roles
-- Description: Bindings of message + emoji -> role for self-assigned roles
-- (issue #24). Reacting with `emoji_key` on `message_id` grants `role_id`;
-- removing the reaction revokes it. A binding may instead name a bot `command`,
-- whose reply the bot DMs to whoever reacts. A message can carry many bindings,
-- the same emoji can be bound on different messages, and the same role can be
-- reachable from several bindings; only the exact binding is unique.
--
-- `emoji_key` is the custom emoji ID, or the Unicode emoji with variation
-- selectors (U+FE0F) stripped, so it matches what reaction events report.
-- `emoji_display` is what the bot shows in listings (`<:name:id>` or the
-- Unicode emoji).

CREATE TABLE IF NOT EXISTS reaction_roles (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  message_id VARCHAR(20) NOT NULL,
  emoji_key VARCHAR(64) NOT NULL,
  emoji_display VARCHAR(100) NOT NULL,
  -- Exactly one target: a role to grant, or a command to run.
  role_id VARCHAR(20),
  command VARCHAR(32),
  created_by VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_reaction_roles_target CHECK ((role_id IS NULL) <> (command IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reaction_roles_binding
  ON reaction_roles(message_id, emoji_key, COALESCE(role_id, ''), COALESCE(command, ''));

CREATE INDEX IF NOT EXISTS idx_reaction_roles_role ON reaction_roles(role_id);
