# Discord AI Assistant Bot - Project Structure

```
discord-ai-bot/
│
├── 📄 README.md                  # Main documentation
├── 📄 CHANGELOG.md               # Version history and changes
├── 📄 CONTRIBUTING.md            # Contribution guidelines
├── 📄 CODE_OF_CONDUCT.md         # Community guidelines
├── 📄 SECURITY.md                # Security policy
├── 📄 LICENSE                    # MIT License
├── 📄 package.json               # Dependencies and scripts
├── 📄 .env.example               # Variable template
├── 📄 .gitignore                 # Git ignore rules
├── 📄 docker-compose.yml         # Docker services (bot + PostgreSQL)
├── 📄 Dockerfile                 # Bot container image
├── 📄 eslint.config.mjs          # ESLint configuration
├── 📄 test-config.js             # Configuration validator
├── 📄 n8n-workflow-example.json  # Example n8n workflow
│
├── 📁 docs/                      # Documentation
│   ├── SETUP.md                  # Setup instructions
│   ├── QUICKSTART.md             # Quick start guide
│   ├── DATABASE.md               # Database documentation
│   ├── N8N_INTEGRATION.md        # n8n workflow guide
│   ├── DOCKER_SETUP.md           # Docker deployment
│   ├── DEPLOYMENT_CHECKLIST.md   # Production checklist
│   ├── PROJECT_STRUCTURE.md      # This file
│   ├── CI_CD_GUIDE.md            # CI/CD documentation
│   └── FAQ.md                    # Common questions
│
├── 📁 migrations/                # Database migrations
│   ├── 001_initial_schema.sql    # Users, conversations, rate limits
│   ├── 002_cleanup_functions.sql # Cleanup stored procedures
│   └── 003_analytics_schema.sql  # Analytics tables
│
├── 📁 scripts/                   # Utility scripts
│   ├── migrate.js                # Migration runner
│   ├── test-bot.sh               # Bot testing script
│   ├── seed-test-data.sh         # Test data seeder
│   ├── verify-dm-config.sh       # Config validator
│   ├── docker-entrypoint.sh      # Docker startup script
│   ├── create-release-package.sh # Release packager
│   └── test-code-mode.js         # Code mode tester
│
├── 📁 tests/                     # Test suites
│   ├── database.test.js          # Database integration tests
│   ├── rate-limiter.test.js      # Rate limiter tests
│   ├── admin-stats-types.test.js # Stats type tests
│   └── final-result.test.js      # Message splitter tests
│
├── 📁 logs/                      # Log files (gitignored)
│   ├── combined.log              # All logs
│   └── error.log                 # Error logs only
│
├── 🚀 src/
│   │
│   ├── 📄 index.js               # Main entry point
│   ├── 📄 deploy-commands.js     # Slash commands deployment
│   │
│   ├── 📁 api/                   # HTTP API
│   │   └── server.js             # Health check endpoints
│   │
│   ├── 📁 db/                    # Database layer
│   │   ├── connection.js         # PostgreSQL connection pool
│   │   └── repositories/         # Data access layer
│   │       ├── analytics-repository.js    # Usage analytics
│   │       ├── conversation-repository.js # Conversation history
│   │       ├── rate-limit-repository.js   # Rate limiting
│   │       └── warning-repository.js      # User warnings
│   │
│   ├── 📁 jobs/                  # Background jobs
│   │   └── database-cleanup.js   # Hourly cleanup task
│   │
│   ├── 📁 slashcommands/         # Slash commands (reserved)
│   │   ├── kick.js               # /kick (reserved for automation)
│   │   ├── ban.js                # /ban (reserved for automation)
│   │   ├── mute.js               # /mute (reserved for automation)
│   │   └── warn.js               # /warn (reserved for automation)
│   │
│   ├── 📁 events/                # Event handlers
│   │   ├── ready.js              # Bot startup
│   │   ├── messageCreate.js      # Message & DM handling
│   │   ├── interactionCreate.js  # Slash command handling
│   │   └── error.js              # Error handling
│   │
│   ├── 📁 utils/                 # Utilities
│   │   ├── logger.js             # Winston logger
│   │   ├── n8n-client.js         # n8n integration
│   │   ├── openai-client.js      # OpenAI integration (optional)
│   │   ├── permissions.js        # Role checking
│   │   ├── error-handler.js      # Error utilities
│   │   ├── rate-limiter.js       # Rate limiting logic
│   │   ├── message-splitter.js   # Discord 2000 char splitting
│   │   ├── token-estimator.js    # Token counting
│   │   └── admin-command-handler.js # Admin prefix commands
│   │
│   ├── 📁 config/                # Configuration
│   │   ├── config.js             # Config manager
│   │   ├── bot-statuses.js       # Bot activity statuses
│   │   └── response-templates.js # Response templates
│   │
│   └── 📁 commands/              # Legacy (moderation prefix commands)
│       └── moderation/
│           ├── kick.js
│           ├── ban.js
│           ├── mute.js
│           └── warn.js

```

## 📊 Feature Map

### 🤖 AI Assistant (Main Feature)
- **File:** `src/events/messageCreate.js`
- **Integration:** `src/utils/n8n-client.js`
- **Config:** `src/config/config.js`
- **Response:** Customizable via `.env` HARDCODED_MENTION_RESPONSE
- **Conversation Memory:** Last 20 messages stored in database, passed to n8n

### 💾 Database Integration
- **Connection:** `src/db/connection.js` - PostgreSQL pool management
- **Repositories:**
  - `src/db/repositories/conversation-repository.js` - Conversation history
  - `src/db/repositories/rate-limit-repository.js` - Rate limiting data
  - `src/db/repositories/warning-repository.js` - User warnings
  - `src/db/repositories/analytics-repository.js` - Usage statistics
- **Migrations:** `migrations/` - Schema versioning
- **Cleanup:** `src/jobs/database-cleanup.js` - Hourly maintenance

### 🏥 Health Monitoring
- **File:** `src/api/server.js`
- **Endpoints:**
  - `GET /health` - Overall health + DB status
  - `GET /alive` - Liveness probe
  - `GET /ready` - Readiness probe
- **Port:** 3000 (configurable via `PORT` env var)

### 🔐 Admin Commands (DM only)
- **Handler:** `src/utils/admin-command-handler.js`
- **Commands:**
  - `!stats [days]` - Usage statistics dashboard
  - `!warn <@user> [reason]` - Issue warning to user
  - `!warnings [@user]` - View warnings
  - `!flushdb confirm` - Clear all database data
  - `!flushmemory` - Clear conversation histories
  - `!help` - Show help message

### 🛡️ Moderation Commands
- **Location:** `src/slashcommands/`
- **Handlers:** `src/events/interactionCreate.js`
- **Authorization:** `src/utils/permissions.js`
- Commands: kick, ban, mute, warn (reserved for automation)
- Prefix `!warn` for manual warnings (admins only)

### 🚦 Rate Limiting
- **File:** `src/utils/rate-limiter.js`
- **Storage:** Database with in-memory fallback
- **Limit:** 5 messages per minute per user
- **Persistence:** Survives bot restarts

### 🔐 Permission System
- **File:** `src/utils/permissions.js`
- **Role-based:** ALLOWED_ROLES_FOR_AI in .env
- **Admin-only:** Moderation commands require ModerateMembers permission

### 📝 Logging System
- **File:** `src/utils/logger.js`
- **Output:** console, logs/combined.log, logs/error.log
- **Level:** Configurable via LOG_LEVEL in .env
- **Rotation:** Manual (logs stored to disk)

## 🔄 Data Flow

```
[Discord User]
      ↓
[Message/Command]
      ↓
[Bot Event Handler]
      ├─→ Mention? → Send hardcoded response
      ├─→ DM? → Check permissions → Send to n8n → Get response
      └─→ Slash Command? → Check permissions → Execute command
      ↓
[Response to User]
```

## 🔧 Configuration Priority

1. `.env` file (production)
2. Environment variables
3. `.env.example` (fallback/defaults)

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| discord.js | 14.25.1 | Discord API |
| dotenv | 17.2.4 | .env loading |
| axios | 1.13.5 | HTTP requests (n8n) |
| winston | 3.19.0 | Logging |
| undici | 7.21.0 | HTTP client || pg | 8.13.1 | PostgreSQL driver |
| express | 5.0.1 | Health check API || eslint | 10.0.0 | Code linting |
| nodemon | 3.1.11 | Dev auto-reload |

## 🚀 Scripts

```bash
npm start             # Production run
npm run dev           # Development with auto-reload
npm run test          # Validate setup
npm run test:unit     # Run unit tests
npm run test:all      # Run all tests
npm run test-config   # Validate configuration
npm run deploy-commands # Deploy slash commands
npm run migrate:up    # Run database migrations
npm run migrate:down  # Rollback last migration
npm run db:seed       # Seed test data
npm run lint          # Run ESLint
npm run release-package # Create release package
```

## 📋 Environment Variables

### Required
- `DISCORD_TOKEN` - Bot token
- `DISCORD_CLIENT_ID` - App ID
- `DISCORD_SERVER_ID` - Server ID
- `N8N_WORKFLOW_URL` - Webhook URL

### Database (Required for persistence)
- `DATABASE_URL` - Full connection string (alternative to individual vars)
- `DB_HOST` - PostgreSQL host (default: postgres)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name (default: discord_bot)
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_SSL` - Enable SSL (default: false)
- `DB_MAX_CONNECTIONS` - Pool size (default: 10)

### Optional
- `N8N_API_KEY` - n8n authentication
- `PORT` - Health check server port (default: 3000)
- `HARDCODED_MENTION_RESPONSE` - Mention response
- `RESTRICTED_RESPONSE` - Access denied message
- `ALLOWED_ROLES_FOR_AI` - Authorized roles
- `BOT_PREFIX` - Command prefix (default: !)
- `LOG_LEVEL` - Logging level (default: info)
- `NODE_ENV` - production/development

## 🎯 Extension Points

### Adding a Command
1. Create file in `src/slashcommands/`
2. Add to slash command builder
3. Define execute function
4. Auto-loaded in `src/index.js`

### Adding an Event
1. Create file in `src/events/`
2. Export with name and execute
3. Auto-loaded in `src/index.js`

### Custom Responses
1. Edit `src/config/response-templates.js`
2. Update `.env` for basic responses
3. Create helper functions in `src/utils/`

### n8n Integration
1. See `N8N_INTEGRATION.md`
2. Configure `N8N_WORKFLOW_URL` in .env
3. Test with `curl` or n8n UI

## 🐛 Debugging

```bash
# Watch logs in real-time
tail -f logs/combined.log

# Watch errors only
tail -f logs/error.log

# Test configuration
node test-config.js

# Check n8n connection
grep "n8n" logs/combined.log

# Check database queries
grep "Database" logs/combined.log

# Test health endpoint
curl http://localhost:3000/health

# Check database connection manually
psql -h localhost -U bot_user -d discord_bot

# Docker: Watch container logs
docker compose logs -f bot

# Docker: Check database logs
docker compose logs -f postgres
```

## 📈 Performance Considerations

- **Message Rate**: Limited by Discord API (5 msgs/5s per user)
- **Rate Limiting**: Database-backed, < 1ms overhead
- **Database Queries**: 2-15ms for typical operations
- **n8n Timeout**: 30 seconds (configurable)
- **Status Rotation**: Every 30 seconds
- **DM Processing**: Async with typing indicator
- **Connection Pool**: 10-20 connections
- **Conversation Fetch**: ~5-15ms for 20 messages
- **Analytics Queries**: 50-200ms for 90-day stats
- **Cleanup Jobs**: Hourly, ~100-500ms per run

## 🔒 Security Checklist

- ✅ .env in .gitignore
- ✅ DISCORD_TOKEN never logged
- ✅ Database credentials secured in environment
- ✅ Role-based access control
- ✅ Moderator-only commands
- ✅ Error messages don't expose internals
- ✅ Input validation before n8n
- ✅ SQL injection protection (parameterized queries)
- ✅ Health endpoints expose minimal info
- ✅ PII handling for GDPR compliance
- ✅ Rate limiting to prevent abuse

## 📞 Support

For issues:
1. Check `logs/combined.log` for errors
2. Run `npm run test-config`
3. Verify .env configuration
4. Check database connectivity (`curl http://localhost:3000/health`)
5. Test with `npm run test:all`
6. Check n8n workflow logs
7. Review Discord permissions
8. See [DATABASE.md](DATABASE.md) for database troubleshooting

---

**Created:** 2024-02-02  
**Last Updated:** 2026-02-16  
**Version:** 2.1.0  
**License:** MIT
