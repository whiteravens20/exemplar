-- Migration: 005 - Dashboard moderation event log
-- Description: Generic, append-only event log that backs the Advanced Logging
-- Dashboard (issue #18). Every human + AI moderation action and every AI
-- moderation decision is recorded here so the dashboard can review, filter and
-- search them long after the ephemeral Discord mod-log embed has scrolled away.
--
-- The table is deliberately denormalized (Discord IDs + usernames stored
-- inline, no FK to `users`): a log row is an immutable snapshot of what was
-- known at the time, and must survive even if the user row is later purged.
--
-- `event_type` is an open string, not an enum, so future event sources can be
-- added without a schema migration. In particular `'feedback'` is reserved for
-- the User Feedback & Rating System (issue #17), which will record rating /
-- comment payloads here (or in its own table read through the same dashboard).

CREATE TABLE IF NOT EXISTS moderation_logs (
  id BIGSERIAL PRIMARY KEY,
  guild_id VARCHAR(20),
  -- warn | ban | kick | mute | unmute | unban | delete | ai_flag  (reserved: feedback)
  event_type VARCHAR(32) NOT NULL,
  -- info | low | medium | high | critical
  severity VARCHAR(16) NOT NULL DEFAULT 'info',
  -- human | ai | system
  actor_type VARCHAR(16) NOT NULL DEFAULT 'human',
  actor_id VARCHAR(20),
  actor_label VARCHAR(120),
  target_user_id VARCHAR(20),
  target_username VARCHAR(120),
  channel_id VARCHAR(20),
  -- resulting action taken (warn | timeout | delete | ban | none | shadow ...)
  action VARCHAR(32),
  reason TEXT,
  -- AI moderation transparency: free-text reasoning summary + the rule the
  -- verdict was attributed to (when the workflow supplies one).
  ai_reasoning TEXT,
  ai_rule VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- TIMESTAMPTZ (not TIMESTAMP): an immutable audit log must order correctly
  -- regardless of the server's TimeZone GUC or DST changes.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modlogs_created ON moderation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modlogs_type_created ON moderation_logs(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modlogs_target_created ON moderation_logs(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modlogs_severity_created ON moderation_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modlogs_actor_type_created ON moderation_logs(actor_type, created_at DESC);

-- Retention cleanup (default 90 days), mirroring cleanup_old_analytics() in
-- migration 003. Returns the number of rows deleted.
CREATE OR REPLACE FUNCTION cleanup_old_moderation_logs(p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM moderation_logs
  WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;
