# Discord AI Assistant Bot - Project Structure

```
exemplar/
│
├── 📄 README.md                  # Main documentation
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
├── 📄 Dockerfile                 # Bot container image (multi-stage)
├── 📄 eslint.config.mjs          # ESLint + typescript-eslint configuration
├── 📄 start.sh                   # Install, build and start without Docker
│
├── 📁 docs/                      # Documentation
│   ├── SETUP.md                  # Setup instructions
│   ├── QUICKSTART.md             # Quick start guide
│   ├── DATABASE.md               # Database documentation
│   ├── N8N_INTEGRATION.md        # n8n workflow guide
│   ├── AI_MODERATION.md          # AI moderation setup and tuning
│   ├── DASHBOARD.md              # Logging dashboard
│   ├── I18N.md                   # Bot language and translations
│   ├── REACTION_ROLES.md         # Reaction roles
│   ├── assistant-workflow.n8n.json  # Importable n8n assistant workflow
│   ├── moderation-workflow.n8n.json # Importable n8n moderation workflow
│   ├── DOCKER_SETUP.md           # Docker deployment
│   ├── DEPLOYMENT_CHECKLIST.md   # Production checklist
│   ├── PROJECT_STRUCTURE.md      # This file
│   └── FAQ.md                    # Common questions
│
├── 📁 migrations/                # Database migrations
│   ├── 001_initial_schema.sql    # Users, conversations, rate limits, warnings
│   ├── 002_cleanup_functions.sql # Cleanup stored procedures
│   ├── 003_analytics_schema.sql  # Analytics tables
│   ├── 004_ai_mod_mutes.sql      # Mutes applied by the warning escalation
│   ├── 005_dashboard_logs.sql    # Moderation event log for the dashboard
│   ├── 006_reaction_roles.sql    # Reaction-role bindings
│   └── 007_atomic_get_or_create_user.sql # Concurrency-safe user upsert
│
├── 📁 scripts/                   # Utility scripts
│   ├── copy-assets.mjs           # Copies the dashboard page and locales into dist/
│   ├── docker-entrypoint.sh      # Docker startup: wait for the database, migrate
│   ├── test-bot.sh               # Checks Node.js, dependencies and the type check
│   ├── verify-dm-config.sh       # Checks the DM-related settings in the code and logs
│   ├── seed-test-data.sh         # Test data seeder
│   └── create-release-package.sh # Release packager
│
├── 📁 tests/                     # Unit tests (Vitest), one file per module
│
├── 📁 logs/                      # Log files (gitignored)
│   ├── combined.log              # All logs
│   └── error.log                 # Error logs only
│
├── 🚀 src/
│   │
│   ├── 📄 index.ts               # Main entry point
│   │
│   ├── 📁 types/                 # Shared TypeScript type definitions
│   │   ├── index.ts              # Barrel exports
│   │   ├── config.ts             # BotConfig interfaces
│   │   ├── database.ts           # DB model interfaces
│   │   ├── discord.ts            # BotEvent, SlashCommand, Client augmentation
│   │   └── n8n.ts                # N8N webhook contracts
│   │
│   ├── 📁 api/                   # HTTP API
│   │   ├── server.ts             # Health check endpoints
│   │   └── dashboard/            # Logging dashboard (opt-in)
│   │       ├── server.ts         # Routes and API
│   │       ├── oauth.ts session.ts rbac.ts http-helpers.ts  # Sign-in and access
│   │       └── public/           # The page: index.html, app.js, styles.css
│   │
│   ├── 📁 db/                    # Database layer
│   │   ├── connection.ts         # PostgreSQL connection pool
│   │   └── repositories/         # Data access layer
│   │       ├── analytics-repository.ts       # Usage analytics
│   │       ├── conversation-repository.ts    # Conversation history
│   │       ├── rate-limit-repository.ts      # Rate limiting
│   │       ├── warning-repository.ts         # User warnings
│   │       ├── ai-mod-mute-repository.ts     # Mutes from the warning escalation
│   │       ├── moderation-log-repository.ts  # Dashboard event log
│   │       └── reaction-role-repository.ts   # Reaction-role bindings
│   │
│   ├── 📁 jobs/                  # Background jobs
│   │   ├── database-cleanup.ts   # Hourly cleanup task
│   │   └── mute-reconciliation.ts # Hourly check of escalation mutes
│   │
│   ├── 📁 scripts/
│   │   └── migrate.ts            # Migration runner (npm run migrate:up)
│   │
│   ├── 📁 slashcommands/         # Slash commands (run in DMs)
│   │   ├── shared.ts             # Command resolution helpers
│   │   ├── kick.ts ban.ts unban.ts          # Moderation
│   │   ├── mute.ts unmute.ts warn.ts        # Moderation
│   │   ├── help.ts rules.ts code.ts flushmemory.ts  # User
│   │   ├── warnings.ts stats.ts flushdb.ts  # User/admin
│   │   └── reactionrole.ts       # Reaction-role bindings (Manage Roles)
│   │
│   ├── 📁 events/                # Event handlers
│   │   ├── ready.ts              # Bot startup
│   │   ├── messageCreate.ts      # Message & DM handling
│   │   ├── interactionCreate.ts  # Slash command + autocomplete handling
│   │   ├── messageReactionAdd.ts messageReactionRemove.ts  # Reaction roles
│   │   ├── messageDelete.ts guildRoleDelete.ts  # Reaction-role cleanup
│   │   └── error.ts              # Error handling
│   │
│   ├── 📁 utils/                 # Utilities
│   │   ├── logger.ts             # Winston logger
│   │   ├── i18n.ts               # Translations (i18next, BOT_LANGUAGE)
│   │   ├── n8n-client.ts         # n8n integration
│   │   ├── permissions.ts        # Role checking
│   │   ├── rate-limiter.ts       # Rate limiting logic
│   │   ├── message-splitter.ts   # Discord 2000 char splitting
│   │   ├── token-estimator.ts    # Token counting
│   │   ├── moderation-actions.ts # Shared moderation action layer
│   │   ├── ai-moderation.ts      # AI moderation: queue, verdicts, enforcement
│   │   ├── concurrency-limiter.ts # Limits simultaneous moderation requests
│   │   ├── reaction-roles.ts     # Reaction-role parsing, checks, index
│   │   ├── reaction-role-manager.ts # Reaction-role runtime
│   │   └── stats-embed.ts        # Statistics embed formatting
│   │
│   ├── 📁 config/                # Configuration
│   │   ├── config.ts             # Config manager
│   │   └── bot-statuses.ts       # Bot activity statuses
│   │
│   ├── 📁 locales/               # User-facing texts, one file per language
│   │   ├── en.json               # English (fallback)
│   │   └── pl.json               # Polish

```

## 📊 Feature Map

### 🤖 AI Assistant (Main Feature)
- **File:** `src/events/messageCreate.ts`
- **Integration:** `src/utils/n8n-client.ts`
- **Config:** `src/config/config.ts`
- **Response:** Texts in `src/locales/`; `HARDCODED_MENTION_RESPONSE` overrides the mention reply
- **Conversation Memory:** Last 20 messages stored in database, passed to n8n

### 💾 Database Integration
- **Connection:** `src/db/connection.ts` - PostgreSQL pool management
- **Types:** `src/types/database.ts` - All DB model interfaces
- **Repositories:**
  - `src/db/repositories/conversation-repository.ts` - Conversation history
  - `src/db/repositories/rate-limit-repository.ts` - Rate limiting data
  - `src/db/repositories/warning-repository.ts` - User warnings
  - `src/db/repositories/analytics-repository.ts` - Usage statistics
  - `src/db/repositories/reaction-role-repository.ts` - Reaction-role bindings
- **Migrations:** `migrations/` - Schema versioning
- **Cleanup:** `src/jobs/database-cleanup.ts` - Hourly maintenance

### 🏥 Health Monitoring
- **File:** `src/api/server.ts`
- **Endpoints:**
  - `GET /health` - Overall health + DB status
  - `GET /alive` - Liveness probe
  - `GET /ready` - Readiness probe
- **Port:** 3000 (`HEALTH_CHECK_PORT`)
- `/health` and `/ready` answer 503 while the database is unreachable; `/alive` always answers 200

### 🔐 User & Admin Commands (slash, run in DMs)
- **Location:** `src/slashcommands/`
- **Dispatch:** `src/events/interactionCreate.ts`
- **Commands:**
  - `/stats [days]` - Usage statistics dashboard (admin)
  - `/warnings [user]` - View warnings (own, or any user for admins)
  - `/flushdb confirm:true` - Clear all database data (admin)
  - `/flushmemory` - Clear conversation histories
  - `/help` - Show help message
  - `/rules` - Show the server rules (`RULES_TEXT`)
  - `/code <message>` - Coding-mode AI request
  - `/reactionrole add|remove|list` - Reaction-role bindings (Manage Roles)

### 🛡️ Moderation Commands
- **Location:** `src/slashcommands/` (kick, ban, unban, mute, unmute, warn)
- **Dispatch:** `src/events/interactionCreate.ts`
- **Action layer:** `src/utils/moderation-actions.ts` (shared, caller-agnostic)
- **Authorization:** `src/utils/permissions.ts` + per-command permission checks
- Run by moderators in DMs; act on the configured server. The shared action
  layer is also what AI moderation calls.

### 🤖 AI Moderation (optional)
- **File:** `src/utils/ai-moderation.ts`
- Sends every eligible message of the enrolled channels to a second n8n
  workflow, a few at a time, and carries out the verdict. See
  [AI_MODERATION.md](AI_MODERATION.md).

### 📊 Logging Dashboard (optional)
- **Location:** `src/api/dashboard/`
- Read-only web page behind Discord sign-in. See [DASHBOARD.md](DASHBOARD.md).

### 🎭 Reaction Roles
- **Files:** `src/utils/reaction-role-manager.ts`, `src/slashcommands/reactionrole.ts`
- See [REACTION_ROLES.md](REACTION_ROLES.md).

### 🚦 Rate Limiting
- **File:** `src/utils/rate-limiter.ts`
- **Storage:** Database with in-memory fallback
- **Limit:** 5 messages per minute per user
- **Persistence:** Survives bot restarts

### 🔐 Permission System
- **File:** `src/utils/permissions.ts`
- **Role-based:** ALLOWED_ROLES_FOR_AI in .env
- **Moderation:** each command checks the invoker's own Discord permission
  (Kick Members, Ban Members, Timeout Members) and the role hierarchy; the
  server owner is above every role

### 📝 Logging System
- **File:** `src/utils/logger.ts`
- **Output:** console, logs/combined.log, logs/error.log
- **Level:** Configurable via LOG_LEVEL in .env
- **Rotation:** 10 MB per file, five files kept
- If `logs/` is not writable the bot logs to the console only and says so at startup

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

1. Environment variables
2. `.env` file (does not override a variable that is already set)
3. Defaults in `src/config/config.ts`

`.env.example` documents every variable; it is a template and is never read.

## 📦 Dependencies

Versions are pinned in `package.json`.

| Package | Purpose |
|---------|---------|
| discord.js | Discord API |
| axios | HTTP requests (n8n) |
| pg | PostgreSQL driver |
| express, express-rate-limit | Health check API and dashboard |
| i18next | Translations |
| winston | Logging |
| dotenv | .env loading |
| typescript, vitest, eslint, typescript-eslint, nodemon | Build, tests, linting, dev reload |

## 🚀 Scripts

```bash
npm start             # Production run (node dist/index.js)
npm run build         # Compile TypeScript to dist/
npm run typecheck     # Type-check without emitting
npm run dev           # Development with auto-reload
npm run test          # Run tests (Vitest)
npm run test:watch    # Run tests on change
npm run migrate:up    # Run database migrations
npm run migrate:down  # Rollback last migration
npm run db:seed       # Seed test data
npm run lint          # Run ESLint + typescript-eslint
npm run lint:fix      # Same, applying auto-fixes
npm run release-package # Create release package
```

## 📋 Environment Variables

### Required
- `DISCORD_TOKEN` - Bot token
- `DISCORD_CLIENT_ID` - App ID
- `DISCORD_SERVER_ID` - Server ID
- `N8N_WORKFLOW_URL` - Webhook URL

### Database (Required for persistence)
- `DB_HOST` - PostgreSQL host (default: localhost; Docker Compose sets `postgres`)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name (default: discord_bot)
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_SSL` - Enable SSL (default: false)
- `DB_MAX_CONNECTIONS` - Pool size (default: 10)

### Optional
- `N8N_API_KEY` - Shared secret sent to the n8n webhooks
- `HEALTH_CHECK_PORT` - Health check server port (default: 3000)
- `BOT_LANGUAGE` - Language of the bot and dashboard (default: en)
- `HARDCODED_MENTION_RESPONSE` - Overrides the mention response
- `RESTRICTED_RESPONSE` - Overrides the access denied message
- `ALLOWED_ROLES_FOR_AI` - Authorized roles
- `MOD_LOG_CHANNEL_ID` - Channel for moderation action logs
- `LOG_LEVEL` - Logging level (default: info)

AI moderation, the dashboard and the remaining options are described in
`.env.example`, which lists every variable the bot reads.

## 🎯 Extension Points

### Adding a Command
1. Create file in `src/slashcommands/` (TypeScript)
2. Implement SlashCommand interface from `src/types/discord.ts`
3. Add its texts to every file in `src/locales/` and read them with `t()`
4. Import and register in `src/index.ts`

### Adding an Event
1. Create file in `src/events/` (TypeScript)
2. Implement BotEvent interface from `src/types/discord.ts`
3. Import and register in `src/index.ts`

### Custom Responses
1. Edit the texts in `src/locales/<language>.json` (see `I18N.md`)
2. Set `HARDCODED_MENTION_RESPONSE` / `RESTRICTED_RESPONSE` in `.env` to override those two replies

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
docker compose logs -f discord-bot

# Docker: Check database logs
docker compose logs -f postgres
```

## 📈 Performance Considerations

- **Rate Limiting**: 5 messages per minute per user, database-backed
- **n8n Timeout**: 2 minutes for the assistant, 5 minutes for AI moderation
- **AI Moderation**: at most `AI_MOD_MAX_CONCURRENT` requests at once, the rest queue
- **Status Rotation**: Every 5 minutes
- **DM Processing**: Async with typing indicator
- **Connection Pool**: 10 connections (`DB_MAX_CONNECTIONS`)
- **Cleanup and mute reconciliation**: Hourly

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
1. Check `logs/combined.log` for errors (`docker compose logs discord-bot` under Docker)
2. Run `bash scripts/test-bot.sh`
3. Verify .env configuration
4. Check database connectivity (`curl http://localhost:3000/health`)
5. Test with `npm test`
6. Check n8n workflow logs
7. Review Discord permissions
8. See [DATABASE.md](DATABASE.md) for database troubleshooting
