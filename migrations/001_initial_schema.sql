-- Migration: 001 - Initial Schema
-- Description: Create base tables for users, conversations, rate limits, and warnings

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  discord_id VARCHAR(20) UNIQUE NOT NULL,
  username VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_discord_id ON users(discord_id);

-- Conversations table (24H retention)
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_time ON conversations(user_id, timestamp DESC);
CREATE INDEX idx_conversations_timestamp ON conversations(timestamp);

-- Rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  request_timestamps JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Warnings table (30D retention per warning)
CREATE TABLE IF NOT EXISTS warnings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  issued_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  issued_by VARCHAR(20) NOT NULL
);

CREATE INDEX idx_warnings_user_expires ON warnings(user_id, expires_at);
CREATE INDEX idx_warnings_expires ON warnings(expires_at);

-- Update trigger for users
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
