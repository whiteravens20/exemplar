-- Migration: 007 - Atomic get_or_create_user
-- Description: get_or_create_user() looked the user up and inserted on a miss.
-- Two calls for a user not yet in the table could both miss, and the second
-- insert then failed on the unique discord_id. Callers saw that as a failed
-- rate-limit check (which moves the limiter to its in-memory fallback for
-- everyone), a conversation that was not saved, or a warning that was not
-- recorded. A single INSERT ... ON CONFLICT is atomic: concurrent calls wait
-- for each other and return the same id.
--
-- Behaviour is otherwise unchanged: a username is stored (and updated_at
-- bumped) only when one is passed.

CREATE OR REPLACE FUNCTION get_or_create_user(
  p_discord_id VARCHAR(20),
  p_username VARCHAR(100) DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  INSERT INTO users (discord_id, username)
  VALUES (p_discord_id, p_username)
  ON CONFLICT (discord_id) DO UPDATE
    SET username = EXCLUDED.username, updated_at = NOW()
    WHERE EXCLUDED.username IS NOT NULL
  RETURNING id INTO v_user_id;

  -- The row exists and no username was passed: nothing was written, so the
  -- statement above returned no row.
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM users
    WHERE discord_id = p_discord_id;
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;
