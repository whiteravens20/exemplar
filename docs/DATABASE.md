# Database Integration Guide

This document describes the PostgreSQL database integration for persistent storage.

## Overview

The bot uses PostgreSQL for persistent storage of:
- **Conversation history** (20 messages per user, 24H retention)
- **Rate limits** (persistent across bot restarts)
- **User warnings** (30D retention per warning)
- **Usage analytics** (90D retention)

## Architecture

### Graceful Degradation
The bot implements **soft fallback** behavior:
- If database is unavailable, the bot continues operating with in-memory storage
- No service interruption for users
- Database errors are logged but don't crash the bot
- Health check endpoint shows database status

### Schema Design

#### Tables
- `users` - Discord user records
- `conversations` - Message history (user + AI responses)
- `rate_limits` - Rate limiting state (JSONB timestamps)
- `warnings` - Moderation warnings with expiry
- `message_stats` - Message analytics
- `command_usage` - Command execution tracking

#### SQL Functions
- `cleanup_old_conversations()` - Removes messages older than 24H
- `cleanup_expired_warnings()` - Removes expired warnings
- `cleanup_old_analytics()` - Removes analytics older than 90D
- `get_user_context(discord_id, limit)` - Fetches conversation history
- `get_or_create_user(discord_id, username)` - Upserts user records
- `get_global_stats(days)` - Aggregated analytics

## Configuration

### Environment Variables

```bash
# Database connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=discord_bot
DB_USER=bot_user
DB_PASSWORD=your_secure_password

# Optional
DB_SSL=false
DB_MAX_CONNECTIONS=10
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000

# Health check
HEALTH_CHECK_PORT=3000
```

### Docker Compose

The PostgreSQL service is pre-configured in `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bot_user"]
```

## Database Setup

### Initial Setup

1. **Start PostgreSQL** (Docker Compose):
   ```bash
   docker-compose up -d postgres
   ```

2. **Run migrations**:
   ```bash
   npm run migrate:up
   ```

3. **Verify connection**:
   ```bash
   curl http://localhost:3000/health
   ```

### Manual Setup (Without Docker)

1. **Create database**:
   ```sql
   CREATE DATABASE discord_bot;
   CREATE USER bot_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE discord_bot TO bot_user;
   ```

2. **Run migrations**:
   ```bash
   npm run migrate:up
   ```

## Migrations

### Running Migrations

```bash
# Apply all pending migrations
npm run migrate:up

# Rollback last migration (removes from tracking only)
npm run migrate:down
```

### Migration Files

Located in `migrations/`:
- `001_initial_schema.sql` - Core tables
- `002_cleanup_functions.sql` - Maintenance functions
- `003_analytics_schema.sql` - Analytics tables

### Creating New Migrations

1. Create file: `migrations/00X_description.sql`
2. Write idempotent SQL (use `IF NOT EXISTS`)
3. Run: `npm run migrate:up`

## Data Retention

### Automatic Cleanup

Cleanup job runs **every hour** and removes:
- Conversations older than **24 hours**
- Warnings past their **30-day expiry**
- Analytics older than **90 days**

### Manual Cleanup

**Admin commands (DM only):**
```bash
!warn <@user> [reason]     # Issue warning to user (admin/moderator)
!warnings [@user]          # View all warnings or specific user
!flushdb confirm           # Clear all data (bot + n8n AI Agent memory)
!stats [days]              # View bot statistics (default: 7 days)
```

**User commands (DM only):**
```bash
!warnings                  # View your active warnings
!flushmemory               # Clear your conversation history (bot + n8n AI Agent)
```

**Note:** 
- Slash commands (`/warn`, etc.) are reserved for bot automation. Users and admins should use prefix commands (`!warn`, `!warnings`, etc.).
- `!flushmemory` clears both bot conversations table AND n8n AI Agent memory (`n8n_chat_histories`)
- `!flushdb` preserves users and warnings but clears all conversations, rate limits, stats, and n8n memory

## Repository Pattern

### Available Repositories

#### ConversationRepository
```javascript
const conversationRepo = require('./db/repositories/conversation-repository');

// Save message
await conversationRepo.saveMessage(discordId, username, userMsg, aiResponse);

// Get recent messages
const history = await conversationRepo.getRecentMessages(discordId, 20);

// Flush user history (clears both bot conversations and n8n AI Agent memory)
await conversationRepo.flushUserConversations(discordId);

// Flush all conversations (admin - clears both bot and n8n memory)
await conversationRepo.flushAllConversations();
```

#### RateLimitRepository
```javascript
const rateLimitRepo = require('./db/repositories/rate-limit-repository');

// Check and update limit
const result = await rateLimitRepo.checkAndUpdateLimit(discordId, 5, 60000);
// Returns: { allowed, remaining, resetAt, current }

// Reset user limit
await rateLimitRepo.resetUserLimit(discordId);
```

#### WarningRepository
```javascript
const warningRepo = require('./db/repositories/warning-repository');

// Add warning (30D expiry)
const count = await warningRepo.addWarning(discordId, username, reason, issuedBy);

// Get active warnings
const active = await warningRepo.getActiveWarnings(discordId);

// Get history
const history = await warningRepo.getWarningHistory(discordId, includeExpired);
```

#### AnalyticsRepository
```javascript
const analyticsRepo = require('./db/repositories/analytics-repository');

// Log message
await analyticsRepo.logMessage(discordId, username, 'dm', 'chat', responseTime, tokens);

// Log command
await analyticsRepo.logCommand(discordId, username, 'warn', false, true);

// Get stats
const stats = await analyticsRepo.getGlobalStats(7); // Last 7 days
```

## n8n Integration

### Conversation Context in Payload

The bot includes conversation history in the payload sent to n8n:

```json
{
  "userId": "123...",
  "message": "current message",
  "conversationContext": [
    {
      "userMessage": "previous user message",
      "aiResponse": "previous AI response",
      "timestamp": "2026-02-12T..."
    }
  ]
}
```

This allows n8n workflows to:
- Access user's conversation history
- Provide contextual AI responses
- Build upon previous interactions

### AI Agent PostgreSQL Memory

For n8n AI Agent nodes, you can configure PostgreSQL as the memory backend:

**Benefits:**
- **Persistent memory** across bot restarts
- **Per-user isolation** using `sessionId: {{ $json.userId }}`
- **Automatic memory management** by n8n
- **Shared database** - same PostgreSQL instance as the bot

**Configuration:**
```javascript
AI Agent Node → Memory Settings:
- Memory Type: PostgreSQL
- Connection: Use bot's PostgreSQL credentials
- Session ID: {{ $json.userId }}
- Window Size: 20 messages
```

**Database Credentials (same as bot):**
```bash
Host: localhost (or postgres in docker-compose)
Port: 5432
Database: exemplar
User: dbot_user
Password: [from .env]
```

n8n will automatically create the `n8n_chat_histories` table to store AI Agent memory.

**Clearing n8n AI Agent Memory:**
- **User command:** `!flushmemory` - clears both bot conversations AND n8n AI Agent memory for that user
- **Admin command:** `!flushdb confirm` - clears ALL conversations (bot + n8n) for all users
- **Manual SQL:** `DELETE FROM n8n_chat_histories WHERE session_id = 'user_discord_id'`

See `docs/N8N_INTEGRATION.md` for detailed setup instructions.

### Database Access from n8n

n8n workflows can access the same database using **PostgreSQL node**.

#### Configuration
1. Add PostgreSQL credentials in n8n
2. Use same connection details as bot:
   - Host: `postgres` (in Docker network) or `localhost`
   - Port: `5432`
   - Database: `discord_bot`
   - User: `bot_user`

#### Example: Get User Context

```sql
SELECT * FROM get_user_context($userId, 20)
```

#### Example: Check Warning Status

```sql
SELECT COUNT(*) as active_warnings
FROM warnings w
JOIN users u ON u.id = w.user_id
WHERE u.discord_id = $userId 
  AND w.expires_at > NOW()
```

#### Example: User Activity Level

```javascript
// Function node
const userId = $input.first().json.userId;
const result = await $db.query(
  `SELECT COUNT(*) as msg_count 
   FROM message_stats ms
   JOIN users u ON u.id = ms.user_id
   WHERE u.discord_id = $1
     AND ms.timestamp > NOW() - INTERVAL '7 days'`,
  [userId]
);

const messageCount = result[0].msg_count;

// Adjust AI personality based on activity
if (messageCount < 5) {
  // New user - be welcoming
} else if (messageCount > 100) {
  // Power user - be direct
}
```

## Analytics & Statistics

### Admin Stats Command

```bash
!stats         # Last 7 days (default)
!stats 30      # Last 30 days
!stats 1       # Last 24 hours
```

Shows:
- Total messages & unique users
- Average response time
- Message breakdown by type (DM/command)
- Top 5 users
- Peak activity hours (top 3)
- Top 5 commands

### Programmatic Access

```javascript
const stats = await analyticsRepo.getGlobalStats(7);

console.log(stats.total_messages);      // BIGINT
console.log(stats.unique_users);        // BIGINT
console.log(stats.avg_response_time_ms); // NUMERIC
console.log(stats.messages_by_type);    // JSONB
console.log(stats.top_users);           // JSONB array
console.log(stats.peak_hours);          // JSONB object
console.log(stats.top_commands);        // JSONB array
```

## Health Monitoring

### Health Check Endpoint

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "database": "connected",  // or "degraded"
  "uptime": 12345.67,
  "timestamp": "2026-02-12T19:00:00.000Z"
}
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /alive
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
```

## Backup & Recovery

### Manual Backup

```bash
# Full backup
docker-compose exec postgres pg_dump -U bot_user discord_bot > backup.sql

# Schema only
docker-compose exec postgres pg_dump -U bot_user --schema-only discord_bot > schema.sql

# Data only
docker-compose exec postgres pg_dump -U bot_user --data-only discord_bot > data.sql
```

### Restore

```bash
docker-compose exec -T postgres psql -U bot_user discord_bot < backup.sql
```

### Automated Backups

Consider setting up:
- **pg_dump** cron job
- **WAL archiving** for point-in-time recovery
- **pgBackRest** for enterprise backups
- Cloud provider backup services (AWS RDS, Azure PostgreSQL)

## Troubleshooting

### Connection Issues

**Problem**: `Database connection unavailable`
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U bot_user -d discord_bot -c 'SELECT 1'
```

**Problem**: Bot starts but database degraded
- Check environment variables in `.env`
- Verify `DB_HOST` is correct (`postgres` in Docker, `localhost` otherwise)
- Ensure migrations have been run

### Migration Failures

**Problem**: Migration fails mid-execution
- Check `schema_migrations` table to see what ran
- Manually fix database state
- Rerun migration

**Problem**: Duplicate schema error
- Migrations use `IF NOT EXISTS` - should be idempotent
- If error persists, check for manual schema changes

### Performance Issues

**Problem**: Slow query performance
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyze table statistics
ANALYZE conversations;
ANALYZE message_stats;
```

**Problem**: High connection count
- Adjust `DB_MAX_CONNECTIONS` in `.env`
- Check for connection leaks in code
- Monitor with: `SELECT count(*) FROM pg_stat_activity;`

## Security Best Practices

1. **Never commit database passwords**
   - Use `.env` file (gitignored)
   - Use secrets management in production

2. **Use strong passwords**
   ```bash
   # Generate secure password
   openssl rand -base64 32
   ```

3. **Enable SSL in production**
   ```bash
   DB_SSL=true
   ```

4. **Restrict network access**
   - PostgreSQL should only be accessible from bot container
   - Use Docker network isolation
   - Firewall rules for external databases

5. **Regular updates**
   ```bash
   docker-compose pull postgres
   docker-compose up -d postgres
   ```

6. **Audit logging**
   - Enable PostgreSQL audit logs
   - Monitor failed login attempts
   - Track privilege escalations

## Testing

### Seed Test Data

```bash
npm run db:seed
```

Creates:
- 3 test users
- Sample conversations
- Test warnings
- Mock analytics data

### Unit Tests

```bash
npm test:db  # (to be implemented)
```

### Integration Tests

```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d

# Run migrations
DB_NAME=discord_bot_test npm run migrate:up

# Run tests
npm test
```

## Performance Optimization

### Indexes

All critical queries are indexed:
- `users(discord_id)` - UNIQUE
- `conversations(user_id, timestamp)` - Composite
- `warnings(user_id, expires_at)` - Composite
- `message_stats(user_id, timestamp)` - Composite
- `command_usage(command_name, executed_at)` - Composite

### Connection Pooling

Configured limits:
- Max connections: 10 (default)
- Idle timeout: 30s
- Connection timeout: 5s

### Query Optimization

- Use SQL functions for complex aggregations
- Leverage JSONB for flexible data structures
- Periodic `VACUUM` and `ANALYZE` (automated in PostgreSQL)

## FAQ

**Q: What happens if database goes down during operation?**
A: Bot continues with in-memory fallbacks. Data written during downtime is lost but service continues.

**Q: Can I use a different database?**
A: Currently PostgreSQL only. Adapting to MySQL/MongoDB would require repository layer changes.

**Q: How do I clear all data?**
A: Admin command `!flushdb confirm` or manually `TRUNCATE` tables.

**Q: Can multiple bot instances share one database?**
A: Yes! The database is designed for this. Rate limiting uses transactions for consistency.

**Q: How much storage is needed?**
A: Approximately:
- 1KB per conversation message
- 100 bytes per analytics entry
- With retention policies, ~1-10GB for moderate usage

**Q: How do I export user data (GDPR)?**
A: Query user's data directly:
```sql
SELECT * FROM conversations WHERE user_id = (SELECT id FROM users WHERE discord_id = 'X');
SELECT * FROM warnings WHERE user_id = (SELECT id FROM users WHERE discord_id = 'X');
```

## Related Documentation

- [Setup Guide](SETUP.md)
- [n8n Integration](N8N_INTEGRATION.md)
- [Docker Setup](DOCKER_SETUP.md)
- [Project Structure](PROJECT_STRUCTURE.md)
