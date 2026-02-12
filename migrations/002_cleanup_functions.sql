-- Migration: 002 - Cleanup and Helper Functions
-- Description: SQL functions for data cleanup and context retrieval

-- Cleanup old conversations (24H retention)
CREATE OR REPLACE FUNCTION cleanup_old_conversations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM conversations
  WHERE timestamp < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired warnings
CREATE OR REPLACE FUNCTION cleanup_expired_warnings()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM warnings
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Get user conversation context
CREATE OR REPLACE FUNCTION get_user_context(
  p_discord_id VARCHAR(20),
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  user_message TEXT,
  ai_response TEXT,
  timestamp TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.user_message,
    c.ai_response,
    c.timestamp
  FROM conversations c
  JOIN users u ON u.id = c.user_id
  WHERE u.discord_id = p_discord_id
    AND c.timestamp > NOW() - INTERVAL '24 hours'
  ORDER BY c.timestamp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get or create user ID
CREATE OR REPLACE FUNCTION get_or_create_user(
  p_discord_id VARCHAR(20),
  p_username VARCHAR(100) DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  -- Try to get existing user
  SELECT id INTO v_user_id
  FROM users
  WHERE discord_id = p_discord_id;
  
  -- Create if doesn't exist
  IF v_user_id IS NULL THEN
    INSERT INTO users (discord_id, username)
    VALUES (p_discord_id, p_username)
    RETURNING id INTO v_user_id;
  ELSIF p_username IS NOT NULL THEN
    -- Update username if provided
    UPDATE users
    SET username = p_username, updated_at = NOW()
    WHERE id = v_user_id;
  END IF;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;
