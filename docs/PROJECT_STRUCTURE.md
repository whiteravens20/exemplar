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
├── 📄 tsconfig.json              # TypeScript configuration
├── 📄 vitest.config.ts           # Vitest test configuration
├── 📄 .env.example               # Variable template
├── 📄 .gitignore                 # Git ignore rules
├── 📄 docker-compose.yml         # Docker services (bot + PostgreSQL)
├── 📄 Dockerfile                 # Bot container image (multi-stage w/ tsc)
├── 📄 eslint.config.mjs          # ESLint + typescript-eslint configuration
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
│   ├── migrate.ts                # Migration runner (TypeScript)
│   ├── test-bot.sh               # Bot testing script
│   ├── seed-test-data.sh         # Test data seeder
│   ├── verify-dm-config.sh       # Config validator
│   ├── docker-entrypoint.sh      # Docker startup script
│   └── create-release-package.sh # Release packager
│
├── 📁 tests/                     # Test suites (Vitest)
│   ├── database.test.ts          # Database integration tests
│   ├── rate-limiter.test.ts      # Rate limiter tests (deprecated)
│   ├── admin-stats-types.test.ts # Stats type tests
│   └── final-result.test.ts      # Message splitter tests
│
├── 📁 logs/                      # Log files (gitignored)
│   ├── combined.log              # All logs
│   └── error.log                 # Error logs only
│
├── 🚀 src/
│   │
│   ├── 📄 index.ts               # Main entry point
│   ├── 📄 deploy-commands.ts     # Slash commands deployment
│   │
│   ├── 📁 types/                 # Shared TypeScript type definitions
│   │   ├── index.ts              # Barrel exports
│   │   ├── config.ts             # BotConfig interfaces
│   │   ├── database.ts           # DB model interfaces
│   │   ├── discord.ts            # BotEvent, SlashCommand, Client augmentation
│   │   └── n8n.ts                # N8N webhook contracts
│   │
│   ├── 📁 api/                   # HTTP API
│   │   └── server.ts             # Health check endpoints
│   │
│   ├── 📁 db/                    # Database layer
│   │   ├── connection.ts         # PostgreSQL connection pool
│   │   └── repositories/         # Data access layer
│   │       ├── analytics-repository.ts    # Usage analytics
│   │       ├── conversation-repository.ts # Conversation history
│   │       ├── rate-limit-repository.ts   # Rate limiting
│   │       └── warning-repository.ts      # User warnings
│   │
│   ├── 📁 jobs/                  # Background jobs
│   │   └── database-cleanup.ts   # Hourly cleanup task
│   │
│   ├── 📁 slashcommands/         # Slash commands (run in DMs)
│   │   ├── shared.ts             # Command resolution helpers
│   │   ├── kick.ts ban.ts unban.ts          # Moderation
│   │   ├── mute.ts unmute.ts warn.ts        # Moderation
│   │   ├── help.ts code.ts flushmemory.ts   # User
│   │   └── warnings.ts stats.ts flushdb.ts  # User/admin
│   │
│   ├── 📁 events/                # Event handlers
│   │   ├── ready.ts              # Bot startup
│   │   ├── messageCreate.ts      # Message & DM handling
│   │   ├── interactionCreate.ts  # Slash command handling
│   │   └── error.ts              # Error handling
│   │
│   ├── 📁 utils/                 # Utilities
│   │   ├── logger.ts             # Winston logger
│   │   ├── n8n-client.ts         # n8n integration
│   │   ├── permissions.ts        # Role checking
│   │   ├── error-handler.ts      # Error utilities
│   │   ├── rate-limiter.ts       # Rate limiting logic
│   │   ├── message-splitter.ts   # Discord 2000 char splitting
│   │   ├── token-estimator.ts    # Token counting
│   │   ├── moderation-actions.ts # Shared moderation action layer
│   │   └── stats-embed.ts        # Statistics embed formatting
│   │
│   ├── 📁 config/                # Configuration
│   │   ├── config.ts             # Config manager
│   │   ├── bot-statuses.ts       # Bot activity statuses
│   │   └── response-templates.ts # Response templates

```

## 📊 Feature Map

### 🤖 AI Assistant (Main Feature)
- **File:** `src/events/messageCreate.ts`
- **Integration:** `src/utils/n8n-client.ts`
- **Config:** `src/config/config.ts`
- **Response:** Customizable via `.env` HARDCODED_MENTION_RESPONSE
- **Conversation Memory:** Last 20 messages stored in database, passed to n8n

### 💾 Database Integration
- **Connection:** `src/db/connection.ts` - PostgreSQL pool management
- **Types:** `src/types/database.ts` - All DB model interfaces
- **Repositories:**
  - `src/db/repositories/conversation-repository.ts` - Conversation history
  - `src/db/repositories/rate-limit-repository.ts` - Rate limiting data
  - `src/db/repositories/warning-repository.ts` - User warnings
  - `src/db/repositories/analytics-repository.ts` - Usage statistics
- **Migrations:** `migrations/` - Schema versioning
- **Cleanup:** `src/jobs/database-cleanup.ts` - Hourly maintenance

### 🏥 Health Monitoring
- **File:** `src/api/server.ts`
- **Endpoints:**
  - `GET /health` - Overall health + DB status
  - `GET /alive` - Liveness probe
  - `GET /ready` - Readiness probe
- **Port:** 3000 (configurable via `PORT` env var)

### 🔐 User & Admin Commands (slash, run in DMs)
- **Location:** `src/slashcommands/`
- **Dispatch:** `src/events/interactionCreate.ts`
- **Commands:**
  - `/stats [days]` - Usage statistics dashboard (admin)
  - `/warnings [user]` - View warnings (own, or any user for admins)
  - `/flushdb confirm:true` - Clear all database data (admin)
  - `/flushmemory` - Clear conversation histories
  - `/help` - Show help message
  - `/code <message>` - Coding-mode AI request

### 🛡️ Moderation Commands
- **Location:** `src/slashcommands/` (kick, ban, unban, mute, unmute, warn)
- **Dispatch:** `src/events/interactionCreate.ts`
- **Action layer:** `src/utils/moderation-actions.ts` (shared, caller-agnostic)
- **Authorization:** `src/utils/permissions.ts` + per-command permission checks
- Run by moderators in DMs; act on the configured server. The shared action
  layer is reused by the planned AI automated moderation (issue #16).

### 🚦 Rate Limiting
- **File:** `src/utils/rate-limiter.ts`
- **Storage:** Database with in-memory fallback
- **Limit:** 5 messages per minute per user
- **Persistence:** Survives bot restarts

### 🔐 Permission System
- **File:** `src/utils/permissions.ts`
- **Role-based:** ALLOWED_ROLES_FOR_AI in .env
- **Admin-only:** Moderation commands require ModerateMembers permission

### 📝 Logging System
- **File:** `src/utils/logger.ts`
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
| express | 5.0.1 | Health check API || typescript | 5.x | TypeScript compiler |
| vitest | latest | Test runner |
| typescript-eslint | latest | TS linting |
| eslint | 10.0.0 | Code linting |
| nodemon | 3.1.11 | Dev auto-reload |

## 🚀 Scripts

```bash
npm start             # Production run (node dist/index.js)
npm run build         # Compile TypeScript to dist/
npm run typecheck     # Type-check without emitting
npm run dev           # Development with auto-reload
npm run test          # Run tests (Vitest)
npm run test:unit     # Run unit tests
npm run test:all      # Run all tests
npm run deploy-commands # Deploy slash commands
npm run migrate:up    # Run database migrations
npm run migrate:down  # Rollback last migration
npm run db:seed       # Seed test data
npm run lint          # Run ESLint + typescript-eslint
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
- `MOD_LOG_CHANNEL_ID` - Channel for moderation action logs
- `LOG_LEVEL` - Logging level (default: info)
- `NODE_ENV` - production/development

## 🎯 Extension Points

### Adding a Command
1. Create file in `src/slashcommands/` (TypeScript)
2. Implement SlashCommand interface from `src/types/discord.ts`
3. Import and register in `src/index.ts`

### Adding an Event
1. Create file in `src/events/` (TypeScript)
2. Implement BotEvent interface from `src/types/discord.ts`
3. Import and register in `src/index.ts`

### Custom Responses
1. Edit `src/config/response-templates.ts`
2. Update `.env` for basic responses
1. Create typed helper functions in `src/utils/`

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

# Type check
npx tsc --noEmit

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
**Version:** 3.0.0  
**License:** MIT
