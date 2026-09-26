-- Migration: 006 - Reaction roles
-- Description: Bindings of message + emoji -> role for self-assigned roles
-- (issue #24). Reacting with `emoji_key` on `message_id` grants `role_id`;
-- removing the reaction revokes it. A message can carry many bindings, the same
-- emoji can be bound on different messages, and the same role can be reachable
-- from several bindings; only the exact triple is unique.
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
  role_id VARCHAR(20) NOT NULL,
  created_by VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_reaction_roles_binding UNIQUE (message_id, emoji_key, role_id)
);

CREATE INDEX IF NOT EXISTS idx_reaction_roles_role ON reaction_roles(role_id);
