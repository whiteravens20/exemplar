# Discord AI Assistant Bot

A Discord bot with n8n workflow integration for AI Assistant and moderation options.

[![Tests](https://github.com/whiteravens20/exemplar/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/whiteravens20/exemplar/actions/workflows/test.yml)
[![Release](https://github.com/whiteravens20/exemplar/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/whiteravens20/exemplar/actions/workflows/release.yml)
[![Docker Build](https://github.com/whiteravens20/exemplar/actions/workflows/docker.yml/badge.svg?branch=main)](https://github.com/whiteravens20/exemplar/actions/workflows/docker.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)

## 📋 Features

### 🤖 AI Assistant
- **Bot works only in DM (Direct Messages)** - a slash command used in a server channel returns the mention response instead of running
- Bot responds to mentions (@mention) on channel with a hardcoded message
- Private messages (DM) trigger n8n workflow
- AI Assistant available only for specific roles
- Other users receive hardcoded response
- **Coding Mode:** Command `/code` sends a request to the coding-specialized LLM
- **Conversation Memory:** Last 20 messages per user with 24H retention

### 💾 Persistent Storage (PostgreSQL)
- **Conversation History:** Last 20 messages per user, 24H retention
- **Rate Limiting:** Persistent across bot restarts
- **User Warnings:** 30-day retention per warning
- **Usage Analytics:** 90-day retention with admin statistics
- **Graceful Degradation:** Bot works with in-memory fallback if DB unavailable
- **Health Monitoring:** `/health` endpoint for orchestration
- **Automatic Migrations:** Database schema updates automatically on startup

### 👮 Commands

All commands are **slash commands** and run in **DMs with the bot**. Used in a
server channel they return the mention response instead. Moderation commands act
on the single configured server (`DISCORD_SERVER_ID`).

**Moderation Commands (require server permissions):**
- `/kick <user> [reason]` - Kick a member (requires Kick Members)
- `/ban <user> [reason]` - Ban a member (requires Ban Members)
- `/unban <user_id>` - Remove a ban (requires Ban Members)
- `/mute <user> <duration> [reason]` - Timeout a member, e.g. `10m`, `1h`, `1d` (requires Timeout Members)
- `/unmute <user>` - Remove a timeout (requires Timeout Members)
- `/warn <user> <reason>` - Issue a warning, saved to the database (requires Timeout Members)

**User Commands:**
- `/help` - Show available commands
- `/code <message>` - Send a request to the coding-specialized LLM
- `/flushmemory` - Clear your conversation history (bot + n8n AI Agent memory)
- `/warnings` - View your active warnings

### 🔐 Admin Commands (DM only)
- `/warnings [user]` - View all warnings or a specific user's warnings
- `/stats [days]` - View bot usage statistics (default: 7 days)
- `/flushdb confirm:true` - Clear database data (bot + n8n AI Agent, preserves users/warnings)

### 📊 Logging Dashboard (optional)
- Secure web interface (Discord OAuth2) to review moderation activity
- Human + AI moderation actions and AI decisions with reasoning, filtering & search
- Per-user lookup: live ban/mute status and active warnings
- Role-based access (owner / admin / allowed roles); read-only and opt-in
- See [docs/DASHBOARD.md](docs/DASHBOARD.md)

### 🔧 Error Handling
- Automatic detection of n8n availability issues
- Detailed error messages for users (network errors, timeouts, 404, auth issues)
- Automatic retry logic with exponential backoff
- Comprehensive logging for debugging
- Customizable error message templates

## 🚀 Installation

### Deployment model

This is an open-source, **self-hosted, single-server** bot. There is no public
hosted instance: each operator creates their own Discord application and runs one
bot instance for one server. That is why the app is **guild-installed** (OAuth2
`bot` + `applications.commands` scopes) and why `DISCORD_SERVER_ID` is required —
all moderation commands act on that one configured server. All commands are slash
commands that run in DMs with the bot; a command used in a server channel just
returns the mention response.

### 1. Requirements
- Node.js 22+
- npm 11+ or yarn
- PostgreSQL 14+ (or use included Docker Compose)

### 2. Clone and Install
```bash
git clone <repository>
cd discord-ai-bot
npm install
```

### 3. Configure `.env`
Copy `.env.example` to `.env` and fill in the variables:

```bash
cp .env.example .env
```

```env
# Discord
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id
DISCORD_SERVER_ID=your_server_id

# n8n
N8N_WORKFLOW_URL=https://your-n8n.com/webhook/workflow
N8N_API_KEY=your_api_key

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=discord_bot
DB_USER=bot_user
DB_PASSWORD=your_secure_password
# DB_SSL=false  # Optional: enable SSL
# DB_MAX_CONNECTIONS=10  # Optional: connection pool size

# Health Check
HEALTH_CHECK_PORT=3000

# Bot Configuration
HARDCODED_MENTION_RESPONSE=Hi! I'm an AI Assistant. Send me a DM to chat with me.

# Moderation
ALLOWED_ROLES_FOR_AI=role_id_1,role_id_2,role_id_3
RESTRICTED_RESPONSE=You don't have permission to use this feature.

# Environment
NODE_ENV=production
```

### 4. Database Setup

**Using Docker Compose (Recommended):**
```bash
# Start all services (Bot + PostgreSQL)
docker compose up -d

# Database migrations run automatically on startup!
# No manual migration steps needed.

# Verify health
curl http://localhost:3000/health
```

The bot automatically:
1. Waits for PostgreSQL to be ready
2. Runs pending database migrations
3. Starts serving Discord

**Manual PostgreSQL Setup (without Docker):**
```bash
# Create database
createdb discord_bot
createuser bot_user

# Run migrations manually
npm run migrate:up
```

See [DATABASE.md](docs/DATABASE.md) for detailed database documentation.

### 5. Running

**Production:**
```bash
npm start
```

**Development (with auto-reload):**
```bash
npm run dev
```

### 6. Running in Docker

For detailed Docker setup instructions, see [DOCKER_SETUP.md](docs/DOCKER_SETUP.md).

**Quick Start with Docker Compose:**
```bash
# Copy and configure environment file
cp .env.example .env

# Start all services (migrations run automatically!)
docker compose up -d

# View logs
docker compose logs -f discord-bot

# Check database status
docker compose ps
```

**What happens automatically:**
- ✅ PostgreSQL starts and becomes healthy
- ✅ Bot waits for database to be ready
- ✅ Database migrations run (creates/updates schema)
- ✅ Bot starts serving Discord

**Manual Docker Commands:**
```bash
# Build image
docker build -t discord-ai-bot:latest .

# Run container (without automatic migrations)
docker run -d \
  --name discord-ai-bot \
  --restart unless-stopped \
  --env-file .env \
  discord-ai-bot:latest

# View logs
docker logs -f discord-ai-bot

# Stop container
docker stop discord-ai-bot
```

## 📖 Detailed Features

### Mentioning Bot in Chat
When someone mentions the bot in chat (e.g., `@BotName`), the bot automatically replies in the channel with a hardcoded message.

```
User: @AIBot help
Bot: Hi! I'm an AI Assistant. Send me a DM to chat with me.
```

**Note:** A slash command used in a server channel does not run — the bot replies with the mention response and points the user to DMs.

### Direct Messages (PM)

**Bot works ONLY in Direct Messages (DM).** All functionality is available only via PM.

#### Basic Chat Mode (Default):
1. User sends PM to bot: `"What is the weather?"`
2. Bot checks if user has allowed role in server
3. If YES - message is sent to n8n workflow with `mode: "chat"`
4. n8n routes to general conversational LLM
5. Bot sends response back to user

#### Code Mode:
1. User runs `/code message:"write a function to sort array"` in a DM
2. Bot sends the message to n8n with `mode: "code"`
3. n8n routes to coding-specialized LLM
4. Bot sends code-focused response back to user

**Payload sent to n8n:**
```json
{
  "userId": "123456789",
  "userName": "TestUser",
  "message": "write a function to sort array",
  "serverId": "987654321",
  "mode": "code",
  "timestamp": "2026-02-09T10:30:00.000Z",
  "platform": "discord"
}
```

#### For Unauthorized Users:
- They receive hardcoded response about access denial

### Moderation Commands

Moderation slash commands (`/kick`, `/ban`, `/unban`, `/mute`, `/unmute`,
`/warn`) are run by moderators in a DM with the bot and act on the configured
server. Each command checks the invoker's server permissions and role hierarchy
before acting.

The affected user is **DMed** on `/kick`, `/ban`, `/mute` and `/warn` with the
reason and — where applicable — the duration (mute timeout, "permanent" for bans,
30-day expiry for warnings). The DM is sent before a kick/ban so it still
reaches the user; the moderator's confirmation embed reports whether it was
delivered.

The action logic lives in a shared, caller-agnostic module
(`src/utils/moderation-actions.ts`). The AI-driven automated moderation
(issue [#16](https://github.com/whiteravens20/exemplar/issues/16)) calls the
same module directly, so manual and automated moderation share one implementation.

### AI moderation (optional)

When enabled, the bot sends every eligible guild message to a dedicated n8n
workflow that classifies it via an LLM and returns one of `allow`, `warn`,
`timeout`, or `delete`. Verdicts are executed through the same action layer
as the slash commands — same DM-to-target, same mod-log entry, same DB
write. The only difference is the mod-log `Moderator` field reads
`AI moderation`.

On top of the per-message verdicts, the bot enforces an escalation ladder
across **every** warning regardless of source (AI or human):

- **3 active warnings** → user is auto-muted until their oldest active warning
  expires (capped at Discord's 28-day timeout maximum). When active count
  drops below the threshold, the bot auto-unmutes them.
- **100 historical warnings** (lifetime, includes expired) → user is auto-banned.

Both thresholds are env-configurable. AI moderation defaults to **off**;
operators should roll out via `AI_MODERATION_MODE=shadow` first to validate
verdict quality before flipping to `enforce`. Full setup guide:
[docs/AI_MODERATION.md](docs/AI_MODERATION.md).

## 🔐 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_TOKEN` | Discord bot token | `your_bot_token` |
| `DISCORD_CLIENT_ID` | Discord app ID | `123456789` |
| `DISCORD_SERVER_ID` | Server ID for AI Assistant | `987654321` |
| `N8N_WORKFLOW_URL` | n8n webhook URL | `https://n8n.io/webhook/abc123` |
| `N8N_API_KEY` | n8n API key (optional) | `key_xyz` |
| `HARDCODED_MENTION_RESPONSE` | Message on mentions | `Hi! I'm an AI Assistant...` |
| `ALLOWED_ROLES_FOR_AI` | Roles with AI access (comma-separated) | `role_id_1,role_id_2` |
| `RESTRICTED_RESPONSE` | Response for denied access | `You don't have permission...` |


```
## 📁 Project Structure

discord-ai-bot/
├── 📄 README.md                  # Main documentation
├── 📄 CHANGELOG.md               # Version history
├── 📄 CONTRIBUTING.md            # Contributing guidelines
├── 📄 CODE_OF_CONDUCT.md         # Community guidelines
├── 📄 SECURITY.md                # Security policy
├── 📄 LICENSE                    # MIT License
├── 📄 package.json               # Dependencies and scripts
├── 📄 tsconfig.json              # TypeScript compiler config
├── 📄 vitest.config.ts           # Vitest test runner config
├── 📄 eslint.config.mjs          # ESLint + typescript-eslint config
├── 📄 .env.example               # Environment variables template
├── 📁 docs/                      # Documentation
│   ├── 📄 SETUP.md               # Configuration instructions
│   ├── 📄 QUICKSTART.md          # Quick start guide
│   ├── 📄 N8N_INTEGRATION.md     # n8n documentation
│   ├── 📄 DOCKER_SETUP.md        # Docker deployment guide
│   ├── 📄 CI_CD_GUIDE.md         # CI/CD pipeline documentation
│   ├── 📄 FAQ.md                 # Frequently asked questions
│   ├── 📄 PROJECT_STRUCTURE.md   # Detailed code structure
│   ├── 📄 DATABASE.md            # Database schema & practices
│   └── 📄 DEPLOYMENT_CHECKLIST.md # Production deployment guide
│
├── 🚀 src/
│   ├── 📄 index.ts               # Main bot entry point
│   ├── 📄 deploy-commands.ts     # Slash commands deployment
│   │
│   ├── 📁 types/                 # Shared TypeScript types
│   │   ├── config.ts             # BotConfig interfaces
│   │   ├── database.ts           # Database model interfaces
│   │   ├── discord.ts            # BotEvent, BotCommand, SlashCommand
│   │   ├── n8n.ts                # N8N webhook payload/response types
│   │   └── index.ts              # Barrel exports
│   │
│   ├── 📁 slashcommands/         # Slash commands (run in DMs)
│   │   ├── shared.ts             # Shared command resolution helpers
│   │   ├── kick.ts, ban.ts, unban.ts        # Moderation commands
│   │   ├── mute.ts, unmute.ts, warn.ts      # Moderation commands
│   │   ├── help.ts, code.ts, flushmemory.ts # User commands
│   │   └── warnings.ts, stats.ts, flushdb.ts # User/admin commands
│   │
│   ├── 📁 events/                # Discord event handlers
│   │   ├── ready.ts              # Bot startup
│   │   ├── messageCreate.ts      # Message & DM handling
│   │   ├── interactionCreate.ts  # Slash command handling
│   │   └── error.ts              # Error handling
│   │
│   ├── 📁 utils/                 # Utility modules
│   │   ├── logger.ts             # Winston logger
│   │   ├── n8n-client.ts         # n8n integration
│   │   ├── permissions.ts        # Role checking
│   │   ├── error-handler.ts      # Error utilities
│   │   ├── rate-limiter.ts       # Rate limiting
│   │   ├── message-splitter.ts   # Message splitting for Discord
│   │   ├── token-estimator.ts    # Token estimation
│   │   ├── moderation-actions.ts # Shared moderation action layer
│   │   └── stats-embed.ts        # Statistics embed formatting
│   │
│   ├── 📁 config/                # Configuration files
│   │   ├── config.ts             # Config manager
│   │   ├── bot-statuses.ts       # Bot activity statuses
│   │   └── response-templates.ts # Response templates
│   │
│   ├── 📁 db/                    # Database layer
│   │   ├── connection.ts         # PostgreSQL connection manager
│   │   └── repositories/
│   │       ├── analytics-repository.ts
│   │       ├── conversation-repository.ts
│   │       ├── rate-limit-repository.ts
│   │       └── warning-repository.ts
│   │
│   ├── 📁 api/                   # HTTP endpoints
│   │   └── server.ts             # Health check server
│   │
│   └── 📁 jobs/                  # Background jobs
│       └── database-cleanup.ts   # Data retention cleanup
│
├── 📁 scripts/                   # Utility scripts
│   ├── migrate.ts                # Database migration runner
│   ├── test-bot.sh               # Bot testing script
│   ├── verify-dm-config.sh       # DM configuration validation
│   ├── docker-entrypoint.sh      # Docker entrypoint
│   ├── seed-test-data.sh         # Test data seeding
│   └── create-release-package.sh # Release packaging
│
├── 📁 migrations/                # SQL migration files
│   ├── 001_initial_schema.sql
│   ├── 002_cleanup_functions.sql
│   └── 003_analytics_schema.sql
│
├── 📁 tests/                     # Test files (Vitest)
│   ├── database.test.ts          # Database integration tests
│   ├── admin-stats-types.test.ts # Admin stats type tests
│   ├── rate-limiter.test.ts      # Rate limiter tests
│   └── final-result.test.ts      # Message splitter tests
│
├── 📁 dist/                      # Compiled JS output (generated)
├── 📁 logs/                      # Log files (auto-generated)
│   ├── combined.log              # All logs
│   └── error.log                 # Error logs only
│
├── 📁 .github/                   # GitHub workflows
│   └── workflows/
│       ├── test.yml              # CI tests + type checking
│       ├── release.yml           # Release automation
│       ├── docker.yml            # Docker builds
│       ├── codeql.yml            # Security scanning
│       └── security.yml          # Dependency audits
│
├── 📄 Dockerfile                 # Multi-stage Docker build
├── 📄 docker-compose.yml         # Docker compose config
└── 📄 start.sh                   # Quick start script
```

## 🔧 Customization

### Change Hardcoded Message
Edit `.env`:
```env
HARDCODED_MENTION_RESPONSE=Your custom message
```

### Add Authorized Roles
Edit `.env`:
```env
ALLOWED_ROLES_FOR_AI=role_id_1,role_id_2,role_id_3
```

### n8n Integration
1. Create workflow in n8n
2. Add Webhook trigger
3. Copy URL to `.env`
4. n8n receives: `userId`, `userName`, `message`, `serverId`, `timestamp`

## 📝 Logs

Logs are saved in:
- `error.log` - errors only
- `combined.log` - all logs
- Console - screen output

## 🔄 CI/CD Pipeline

This project includes automated GitHub Actions workflows for testing, releases, and Docker builds.

| Workflow | Status | Purpose |
|----------|--------|---------|
| **Tests** | [![Tests](https://github.com/whiteravens20/exemplar/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/whiteravens20/exemplar/actions/workflows/test.yml) | Code quality checks on every push/PR |
| **Release** | [![Release](https://github.com/whiteravens20/exemplar/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/whiteravens20/exemplar/actions/workflows/release.yml) | Automatic releases with changelog |
| **Docker** | [![Docker Build](https://github.com/whiteravens20/exemplar/actions/workflows/docker.yml/badge.svg?branch=main)](https://github.com/whiteravens20/exemplar/actions/workflows/docker.yml) | Docker image build & push |

**Quick Deploy:**
```bash
# Update version in package.json
npm install && git add package.json package-lock.json
git commit -m "Bump version to 1.0.1"
git push origin main

# Workflows automatically:
# 1. Run tests
# 2. Create release with changelog
# 3. Build Docker image
# 4. Push to ghcr.io
```

For complete CI/CD documentation, see [CI_CD_GUIDE.md](docs/CI_CD_GUIDE.md).

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](docs/SETUP.md) | Complete setup guide (Discord, n8n, environment variables) |
| [QUICKSTART.md](docs/QUICKSTART.md) | Quick start guide for getting bot running |
| [DATABASE.md](docs/DATABASE.md) | PostgreSQL setup, schema, and best practices |
| [DASHBOARD.md](docs/DASHBOARD.md) | Advanced logging dashboard (web interface) setup |
| [USAGE_GUIDE.md](docs/USAGE_GUIDE.md) | User guide and commands reference |
| [N8N_INTEGRATION.md](docs/N8N_INTEGRATION.md) | n8n workflow integration details |
| [DOCKER_SETUP.md](docs/DOCKER_SETUP.md) | Docker deployment guide |
| [DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) | Production deployment checklist |
| [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) | Project architecture and structure |
| [CI_CD_GUIDE.md](docs/CI_CD_GUIDE.md) | CI/CD pipeline documentation |
| [FAQ.md](docs/FAQ.md) | Frequently asked questions |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute to this project |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community guidelines and standards |
| [SECURITY.md](SECURITY.md) | Security policy and vulnerability reporting |

## 🤝 Contributing

We'd love your help making this project better! 🌟

Whether you're fixing bugs 🐛, adding features ✨, or improving docs 📚 - all contributions are welcome! Check out our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) to get started.

**Security:** Found a vulnerability? Please report it responsibly via our [Security Policy](SECURITY.md). 🔒

**Quick Start for Contributors:**
1. 🍴 Fork the repository
2. 🌿 Create a feature branch
3. 💻 Make your changes
4. ✅ Test thoroughly
5. 🚀 Submit a pull request

Have questions? Open an issue or start a discussion - we're here to help! 💬

## 📄 License

MIT
