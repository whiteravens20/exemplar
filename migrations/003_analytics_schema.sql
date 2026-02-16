-- Migration: 003 - Analytics Schema
-- Description: Tables and functions for message analytics and usage statistics

-- Message statistics table
CREATE TABLE IF NOT EXISTS message_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(20) NOT NULL, -- 'dm', 'mention', 'command'
  mode VARCHAR(10) DEFAULT 'chat', -- 'chat', 'code'
  timestamp TIMESTAMP DEFAULT NOW(),
  response_time_ms INTEGER,
  tokens_estimated INTEGER
);

CREATE INDEX idx_stats_user_time ON message_stats(user_id, timestamp DESC);
CREATE INDEX idx_stats_type_time ON message_stats(message_type, timestamp DESC);
CREATE INDEX idx_stats_timestamp ON message_stats(timestamp);

-- Command usage table
CREATE TABLE IF NOT EXISTS command_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  command_name VARCHAR(50) NOT NULL,
  is_admin_command BOOLEAN DEFAULT false,
  executed_at TIMESTAMP DEFAULT NOW(),
  success BOOLEAN DEFAULT true
);

CREATE INDEX idx_cmd_usage ON command_usage(command_name, executed_at DESC);
CREATE INDEX idx_cmd_user ON command_usage(user_id, executed_at DESC);

-- Cleanup old analytics (90D retention)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS TABLE (
  stats_deleted INTEGER,
  commands_deleted INTEGER
) AS $$
DECLARE
  v_stats_deleted INTEGER;
  v_commands_deleted INTEGER;
BEGIN
  DELETE FROM message_stats
  WHERE timestamp < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_stats_deleted = ROW_COUNT;
  
  DELETE FROM command_usage
  WHERE executed_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_commands_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT v_stats_deleted, v_commands_deleted;
END;
$$ LANGUAGE plpgsql;

-- Get global statistics
CREATE OR REPLACE FUNCTION get_global_stats(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  total_messages BIGINT,
  unique_users BIGINT,
  avg_response_time_ms NUMERIC,
  messages_by_type JSONB,
  top_users JSONB,
  peak_hours JSONB,
  top_commands JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH stats_period AS (
    SELECT * FROM message_stats
    WHERE timestamp > NOW() - (p_days || ' days')::INTERVAL
  ),
  type_counts AS (
    SELECT 
      jsonb_object_agg(message_type, cnt) as types
    FROM (
      SELECT message_type, COUNT(*) as cnt
      FROM stats_period
      GROUP BY message_type
    ) t
  ),
  user_counts AS (
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'userId', u.discord_id,
          'username', u.username,
          'count', cnt
        ) ORDER BY cnt DESC
      ) as users
    FROM (
      SELECT user_id, COUNT(*) as cnt
      FROM stats_period
      GROUP BY user_id
      ORDER BY cnt DESC
      LIMIT 10
    ) uc
    JOIN users u ON u.id = uc.user_id
  ),
  hour_counts AS (
    SELECT 
      jsonb_object_agg(hour_of_day, msg_count) as hours
    FROM (
      SELECT 
        EXTRACT(HOUR FROM timestamp)::INTEGER as hour_of_day,
        COUNT(*) as msg_count
      FROM stats_period
      GROUP BY hour_of_day
    ) h
  ),
  cmd_counts AS (
    SELECT 
      jsonb_agg(
        jsonb_build_object('command', command_name, 'count', cnt)
        ORDER BY cnt DESC
      ) as commands
    FROM (
      SELECT command_name, COUNT(*) as cnt
      FROM command_usage
      WHERE executed_at > NOW() - (p_days || ' days')::INTERVAL
      GROUP BY command_name
      ORDER BY cnt DESC
      LIMIT 10
    ) c
  )
  SELECT 
    COUNT(*)::BIGINT,
    COUNT(DISTINCT user_id)::BIGINT,
    ROUND(AVG(response_time_ms)::NUMERIC, 2),
    COALESCE((SELECT types FROM type_counts), '{}'::jsonb),
    COALESCE((SELECT users FROM user_counts), '[]'::jsonb),
    COALESCE((SELECT hours FROM hour_counts), '{}'::jsonb),
    COALESCE((SELECT commands FROM cmd_counts), '[]'::jsonb)
  FROM stats_period;
END;
$$ LANGUAGE plpgsql;

-- Get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(
  p_discord_id VARCHAR(20),
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_messages BIGINT,
  avg_response_time_ms NUMERIC,
  messages_by_type JSONB,
  commands_used JSONB,
  first_message TIMESTAMP,
  last_message TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  WITH user_data AS (
    SELECT id FROM users WHERE discord_id = p_discord_id
  ),
  user_stats AS (
    SELECT * FROM message_stats
    WHERE user_id = (SELECT id FROM user_data)
      AND timestamp > NOW() - (p_days || ' days')::INTERVAL
  )
  SELECT 
    COUNT(*)::BIGINT,
    ROUND(AVG(response_time_ms)::NUMERIC, 2),
    (SELECT jsonb_object_agg(message_type, cnt)
     FROM (SELECT message_type, COUNT(*) as cnt FROM user_stats GROUP BY message_type) t),
    (SELECT jsonb_agg(jsonb_build_object('command', command_name, 'count', cnt))
     FROM (
       SELECT command_name, COUNT(*) as cnt
       FROM command_usage
       WHERE user_id = (SELECT id FROM user_data)
         AND executed_at > NOW() - (p_days || ' days')::INTERVAL
       GROUP BY command_name
     ) c),
    MIN(timestamp),
    MAX(timestamp)
  FROM user_stats;
END;
$$ LANGUAGE plpgsql;
