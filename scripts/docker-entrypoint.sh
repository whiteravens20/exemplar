#!/bin/sh
set -e

echo "🔄 Starting Discord bot initialization..."

# Function to wait for PostgreSQL
wait_for_postgres() {
  echo "⏳ Waiting for PostgreSQL to be ready..."
  
  max_attempts=30
  attempt=0
  
  while [ $attempt -lt $max_attempts ]; do
    if node -e "
      import pg from 'pg';
      const { Pool } = pg;
      const pool = new Pool({
        host: process.env.DB_HOST || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'discord_bot',
        user: process.env.DB_USER || 'bot_user',
        password: process.env.DB_PASSWORD
      });
      pool.connect()
        .then(() => { pool.end(); process.exit(0); })
        .catch(() => process.exit(1));
    " 2>/dev/null; then
      echo "✅ PostgreSQL is ready!"
      return 0
    fi
    
    attempt=$((attempt + 1))
    echo "   Attempt $attempt/$max_attempts - waiting 2s..."
    sleep 2
  done
  
  echo "❌ PostgreSQL did not become ready in time"
  return 1
}

# Function to run database migrations
run_migrations() {
  echo "🔄 Running database migrations..."
  
  if npm run migrate:up; then
    echo "✅ Database migrations completed successfully"
    return 0
  else
    echo "⚠️  Migration failed or no database available"
    echo "   Bot will start with in-memory fallback"
    return 0  # Don't fail - allow graceful degradation
  fi
}

# Main execution
echo "📊 Database configuration:"
echo "   Host: ${DB_HOST:-postgres}"
echo "   Port: ${DB_PORT:-5432}"
echo "   Database: ${DB_NAME:-discord_bot}"
echo "   User: ${DB_USER:-bot_user}"

# Wait for PostgreSQL and run migrations
if wait_for_postgres; then
  run_migrations
else
  echo "⚠️  Starting bot without database (in-memory mode)"
fi

echo "🚀 Starting Discord bot..."
echo ""

# Execute the main command
exec "$@"
