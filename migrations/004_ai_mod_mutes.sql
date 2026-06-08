-- Migration: 004 - AI moderation active mutes
-- Description: Tracks which active timeouts the bot applied as part of the
-- escalation ladder (3 active warnings -> auto-mute). Existence of a row for
-- a user means the reconciliation job owns their current timeout and may
-- extend or lift it as their active warning count changes. Human-set
-- timeouts (via /mute) do NOT have a row here and are never touched by the
-- reconciliation job.

CREATE TABLE IF NOT EXISTS ai_mod_active_mutes (
  user_discord_id VARCHAR(20) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_mod_mutes_expires
  ON ai_mod_active_mutes(expires_at);
