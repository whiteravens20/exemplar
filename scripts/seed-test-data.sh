#!/bin/bash
# Test data seeder for development/testing

set -e

# Source .env if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Database configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-discord_bot}
DB_USER=${DB_USER:-bot_user}

echo "Seeding test data to $DB_NAME..."

# Connect to database and insert test data
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF

-- Create test users
INSERT INTO users (discord_id, username) VALUES 
  ('123456789', 'TestUser1'),
  ('987654321', 'TestUser2'),
  ('111222333', 'AdminUser')
ON CONFLICT (discord_id) DO NOTHING;

-- Create test conversations
INSERT INTO conversations (user_id, user_message, ai_response, timestamp) 
SELECT 
  u.id,
  'Test message ' || i,
  'Test response ' || i,
  NOW() - (i || ' hours')::INTERVAL
FROM users u, generate_series(1, 5) as i
WHERE u.discord_id = '123456789';

-- Create test warnings
INSERT INTO warnings (user_id, reason, issued_at, expires_at, issued_by)
SELECT 
  u.id,
  'Test warning',
  NOW() - INTERVAL '5 days',
  NOW() + INTERVAL '25 days',
  '111222333'
FROM users u
WHERE u.discord_id = '123456789';

-- Create test analytics
INSERT INTO message_stats (user_id, message_type, mode, response_time_ms, tokens_estimated, timestamp)
SELECT 
  u.id,
  CASE WHEN random() < 0.8 THEN 'dm' ELSE 'command' END,
  CASE WHEN random() < 0.7 THEN 'chat' ELSE 'code' END,
  (random() * 3000 + 500)::INTEGER,
  (random() * 1000 + 100)::INTEGER,
  NOW() - (random() * 168)::INTEGER * INTERVAL '1 hour'
FROM users u, generate_series(1, 20) as i;

INSERT INTO command_usage (user_id, command_name, is_admin_command, executed_at)
SELECT 
  u.id,
  CASE (random() * 3)::INTEGER
    WHEN 0 THEN 'help'
    WHEN 1 THEN 'warnings'
    ELSE 'warn'
  END,
  false,
  NOW() - (random() * 168)::INTEGER * INTERVAL '1 hour'
FROM users u, generate_series(1, 10) as i;

EOF

echo "✅ Test data seeded successfully!"
echo ""
echo "Test users created:"
echo "  - TestUser1 (123456789) - has conversations and warnings"
echo "  - TestUser2 (987654321)"
echo "  - AdminUser (111222333)"
