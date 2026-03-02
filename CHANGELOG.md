# Changelog

All important changes in this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## Quick Links
- [Current Version (v3.0.0)](#300---unreleased)
- [Previous Version (v2.1.0)](#210---2026-02-16)
- [Migration Guide (v2.x → v3.0.0)](#migrating-from-v2x-to-v300)
- [Migration Guide (v2.0.x → v2.1.0)](#migrating-from-v20x-to-v210)
- [Migration Guide (v1.x → v2.0.0)](#migrating-from-v1x-to-v200)
- [Future Roadmap](#future-roadmap)
- [Known Issues](#known-issues)
- [Security](#security)

---

## [3.0.0] - Unreleased

> **Major Release** - Full TypeScript rewrite with strict typing, ESM modules, and Vitest testing.

### 🎉 Highlights

- **🔷 TypeScript Migration**: Complete rewrite of all source files from JavaScript to TypeScript with `strict: true`
- **📦 ESM Modules**: Migrated from CommonJS (`require`/`module.exports`) to ES Modules (`import`/`export`)
- **🧪 Vitest**: Replaced raw Node.js assert tests with Vitest test framework
- **🏗️ Build Step**: Added `tsc` compilation step — source in `src/`, output in `dist/`
- **📐 Shared Types**: Centralized type definitions in `src/types/` for database models, Discord events, n8n contracts, and config
- **🔧 typescript-eslint**: Updated ESLint to use typescript-eslint for static analysis

### Breaking Changes
- **Node.js 22+** required (unchanged)
- **Build required**: Run `npm run build` before `npm start` (or use `npm run dev` for development)
- **Entry point changed**: `dist/index.js` instead of `src/index.js`
- **ESM**: Package uses `"type": "module"` — `require()` no longer works
- **Docker**: Updated Dockerfile with TypeScript build stage, CMD now runs `dist/index.js`
- **CI/CD**: Workflows updated to include `tsc --noEmit` type checking and build step

### Added
- `tsconfig.json` — TypeScript compiler configuration (strict, ES2023, NodeNext)
- `vitest.config.ts` — Vitest test runner configuration
- `src/types/` — Shared type definitions:
  - `database.ts` — All database model interfaces
  - `discord.ts` — BotEvent, BotCommand, SlashCommand interfaces + Client augmentation
  - `n8n.ts` — N8N webhook payload/response types
  - `config.ts` — BotConfig interface hierarchy
  - `index.ts` — Barrel exports
- TypeScript declarations and source maps generated on build

### Changed
- All 22 source files in `src/` migrated from `.js` to `.ts`
- All 4 test files migrated to Vitest with TypeScript
- `scripts/migrate.js` → `scripts/migrate.ts`
- `eslint.config.mjs` updated to use `typescript-eslint`
- `package.json`: version 3.0.0, added `"type": "module"`, new scripts (build, typecheck)
- `Dockerfile`: multi-stage build with TypeScript compilation
- GitHub Actions workflows: syntax checks replaced with `tsc --noEmit`
- Static imports replace dynamic `fs.readdirSync` + `require()` in index.ts
- `pg` imported as default ESM import with destructuring for Pool

### Removed
- `test-config.js` — replaced by `tsc --noEmit` type checking
- `scripts/test-code-mode.js` — obsolete test script
- All `.js` source files in `src/` (replaced by `.ts`)
- All `.js` test files in `tests/` (replaced by `.ts`)

### Migrating from v2.x to v3.0.0

1. **Install dependencies**: `npm install` (new devDependencies: typescript, vitest, typescript-eslint)
2. **Build**: `npm run build` (compiles TypeScript to `dist/`)
3. **Update start command**: Use `node dist/index.js` instead of `node src/index.js`
4. **Docker**: Rebuild image — Dockerfile now includes build stage
5. **CI/CD**: Workflows auto-updated — no manual changes needed
6. **Custom code**: If you added custom `.js` files to `src/`, convert them to TypeScript

---

## [Unreleased]

*No unreleased changes yet.*

---

## [2.1.0] - 2026-02-16

> **Feature Release** - PostgreSQL database integration with persistent storage and analytics.

### 🎉 Highlights

- **💾 PostgreSQL Integration**: Persistent storage for conversations, warnings, rate limits, and analytics
- **📊 Analytics System**: Usage statistics and admin dashboard commands
- **🔐 Enhanced Admin Tools**: New `!stats`, `!flushdb`, and improved `!warn` commands
- **🏥 Health Monitoring**: HTTP endpoints for orchestration and load balancer integration
- **🧹 Automatic Cleanup**: Background jobs for data retention management
- **📝 Conversation Memory**: AI access to last 20 messages for context-aware responses
- **🐳 Docker PostgreSQL**: Integrated database service in docker-compose

### Removed
- Removed `/help` slash command - now available only as `!help` prefix command in DM

### Changed
- Removed `/warnings` slash command - now available only as `!warnings` prefix command
- `!warnings` accessible to all users (view own warnings) and admins (view all or specific user)
- Updated admin command help to separate admin and user commands

### Added
- 💾 **PostgreSQL Database Integration** - Persistent storage for bot data
  - Conversation history (20 messages per user, 24H retention)
  - Rate limiting persistence across restarts
  - User warnings with 30-day retention
  - Usage analytics with 90-day retention
  - Graceful degradation - bot works with in-memory fallback if DB unavailable
- 📊 **Analytics System** - Message and command usage tracking
  - Admin command `!stats [days]` for usage statistics
  - Tracks message types, response times, and user activity
  - Peak hours analysis and top users/commands reporting
- 🔐 **Admin Commands** - New prefix commands in DM
  - `!stats [days]` - View bot statistics (admin only)
  - `!flushdb confirm` - Clear database (admin only)
  - `!flushmemory` - Clear conversation history (all users)
- 🏥 **Health Check Endpoint** - HTTP health monitoring
  - `/health` - Overall health status with DB connectivity
  - `/alive` - Liveness probe for orchestration
  - `/ready` - Readiness probe for load balancers
- 🧹 **Automatic Data Cleanup** - Hourly background jobs
  - Removes conversations older than 24H
  - Removes expired warnings (30D)
  - Removes analytics older than 90D
- 📝 **Conversation Context** - AI has access to recent conversation history
  - Last 20 messages passed to n8n workflows
  - Enables context-aware AI responses
- ⚠️ **Active Warning System** - Admin prefix command `!warn` for manual moderation
  - `!warn <@user> [reason]` in DM for admins/moderators
  - Stores warnings in database with automatic expiry (30D)
  - `/warnings` slash command to view active warnings
  - DM notifications for warned users
  - `/warn` slash command reserved for bot automation
- 🐳 **PostgreSQL Docker Service** - Integrated database in docker-compose
  - PostgreSQL 16 Alpine image
  - Persistent volume storage
  - Health checks and automatic restarts
- 📚 **Comprehensive Documentation** - New DATABASE.md guide
  - Database schema and architecture
  - Repository pattern examples
  - n8n integration with database
  - Backup and recovery procedures
  - Performance optimization tips

### Changed
- 🔄 **Rate Limiter** - Now uses database with in-memory fallback
  - Persistent across bot restarts
  - Supports multiple bot instances
- 🧪 **Test Suite** - Added database integration tests
- 📦 **Dependencies** - Added `pg` (PostgreSQL driver) and `express` (health endpoint)

### Fixed
- 🐛 Fixed rate limiting not persisting across restarts
- 🐛 Fixed conversation context loss on bot restart
- 🐛 Fixed PostgreSQL numeric type handling in statistics queries
- 🐛 Removed unused variables and improved code quality

### Infrastructure
- 🐳 **Docker Integration**: Added PostgreSQL 16 Alpine service to docker-compose
- 🔄 **Automatic Migrations**: Database schema updates run automatically on container startup
- 📦 **Dependencies**: Updated dotenv to latest version

### Technical Details
- **Database**: PostgreSQL 16 with persistent volumes
- **API**: Express health check server on port 3000
- **Jobs**: Hourly cleanup jobs for expired data
- **Repositories**: Analytics, Conversation, Rate Limit, Warning repositories
- **Memory Management**: n8n AI Agent memory cleared via `!flushmemory` and `!flushdb`

---

## [2.0.0] - 2026-02-09

> **Major Release** - This is a significant update with breaking changes. Please read the migration guide before upgrading.

### 🎉 Highlights

- **🔒 DM-Only Mode**: Enhanced privacy - bot now exclusively operates in Direct Messages
- **💻 Coding Mode**: New `!code` prefix routes to specialized coding LLM
- **🚦 Rate Limiting**: Built-in spam protection (5 messages/minute per user)
- **✂️ Smart Message Splitting**: Handles Discord's 2000 char limit intelligently
- **⚡ Node.js 22**: Upgraded to latest LTS for better performance
- **🔐 Enhanced Security**: CodeQL, Dependabot, npm audit, and Trivy scanning
- **📚 Complete Documentation**: New USAGE_GUIDE.md and DEPLOYMENT_CHECKLIST.md

### 🚨 Breaking Changes

- **DM-Only Mode**: Bot now only responds to Direct Messages. All guild/channel interactions are ignored (except hardcoded mention response)
- **Node.js 22 Required**: Minimum Node.js version upgraded from 20.x to 22.x LTS
- **Manual Moderation Disabled**: Slash commands for moderation are reserved for future automated moderation system

### Added

#### Core Features
- ✨ **Message Splitter Utility** - Intelligent message splitting for Discord 2000 char limit
  - Preserves code blocks and formatting
  - Handles nested code blocks
  - Splits on natural boundaries (paragraphs, sentences)
- 🚦 **Rate Limiting** - Protection against spam and abuse
  - 5 messages per minute per user
  - Clear feedback messages with wait time
  - Automatic cleanup of expired limits
- 💬 **Coding Mode Support** - Dual AI mode functionality
  - `!code` prefix for coding-specific queries
  - Routes to specialized LLM in n8n workflow
  - Default chat mode for general conversation
- 🔒 **DM-Only Mode** - Enhanced privacy and security
  - Bot only responds to Direct Messages
  - Ignores all guild/channel commands
  - Hardcoded mention response in public channels
- 📋 **Usage Guide** - Comprehensive user and admin documentation

#### Development & Testing
- ✅ Rate limiter unit tests with Jest
- 🔍 verify-dm-config.sh script for configuration validation

#### Security & CI/CD
- 🔐 **CodeQL Analysis** - Automated code security scanning
- 🤖 **Dependabot** - Automated dependency updates
  - Daily security updates
  - Weekly dependency updates
  - Grouped updates by dependency type
- 🛡️ **Security Workflow** - npm audit and vulnerability scanning
- 🐳 **Enhanced Docker Workflow** - Trivy vulnerability scanning

#### Documentation
- 📖 USAGE_GUIDE.md - Best practices and usage scenarios
- ✅ DEPLOYMENT_CHECKLIST.md - Production deployment guide

### Changed

#### Dependencies & Runtime
- 🔼 Upgraded Node.js requirement from 20.x to 22.x LTS
- 🔼 Updated all dependencies to latest versions:
  - discord.js: 14.14.0 → 14.25.1
  - axios: 1.6.2 → 1.13.5
  - dotenv: 16.3.1 → 17.2.4
  - winston: 3.11.0 → 3.19.0
  - undici: 7.20.0 → 7.21.0
  - eslint: 9.39.2 → 10.0.0
  - @eslint/js: 9.39.2 → 10.0.1
  - nodemon: 3.0.2 → 3.1.11

#### Bot Functionality
- 🔄 **Enhanced n8n Client** 
  - Retry logic with exponential backoff (3 attempts)
  - Better error handling and logging
  - Timeout configuration (30s default)
- 🎯 **Improved Message Handling**
  - DM-only restriction enforced
  - Mode-based routing (chat vs code)
  - Better error messages and user feedback
- ⚡ **Optimized Event Handlers**
  - Ignore bot messages
  - Skip guild channels automatically
  - Improved permission checks

#### Moderation Commands
- 🔓 **Removed Permission Checks** from slash commands
  - Reserved for future automated moderation
  - Commands disabled for manual use
  - Prepared for AI-driven moderation system

#### Documentation
- 📝 Updated N8N_INTEGRATION.md with coding mode routing
- 📝 Updated README with DM-only and coding mode features
- 📝 Enhanced PROJECT_STRUCTURE.md with new utilities
- 📝 Updated bot status messages for clarity
- 📝 Improved response templates

### Fixed
- 🔒 Resolved security vulnerabilities in undici by adding package overrides
- 🧪 Fixed test script to check for Node.js 22+ instead of 20+ to match package.json requirements
- 🐛 Fixed potential message formatting issues with long responses

### Removed
- ❌ NEXT_STEPS.md - Replaced by DEPLOYMENT_CHECKLIST.md
- ❌ Auto-approval step for minor dependency updates
- ❌ Manual permission checks from moderation commands

### Infrastructure
- 🐳 Updated Dockerfile to use Node.js 22-alpine base image
- 🔧 Updated all GitHub Actions workflows to use Node.js 22.x
- 🔧 Enhanced Docker workflow with Trivy security scanning
- 🔧 Added workflow_run trigger for release workflow
- 📝 Updated documentation to reflect Node.js 22 requirement

### Security
- 🔐 Added CodeQL security analysis workflow
- 🔐 Added Dependabot configuration for automated updates
- 🔐 Enhanced security workflow with npm audit
- 🔐 Improved logging to exclude PII (message content not logged)
- 🔐 Rate limiting to prevent abuse

### Upgrade Path
**From v1.0.x:**
1. Update Node.js to 22.x LTS
2. Run `npm install` to update dependencies
3. Update n8n workflow with mode routing (see N8N_INTEGRATION.md)
4. Inform users to switch to DM-only interaction
5. Test thoroughly in staging environment
6. Deploy to production

**Estimated Downtime:** 5-10 minutes for deployment

**Rollback Plan:** Keep v1.0.2 Docker image or git tag for quick rollback if issues arise

### Technical Details
- **Bundle Size**: Package reduced by 15% through dependency optimization
- **Test Coverage**: Added rate limiter unit tests
- **CI/CD**: 4 new GitHub workflows for security and automation
- **Docker**: Multi-stage build with alpine base (~180MB)
- **Logging**: Winston configured with rotation ready (implement in v2.1.0)
- **Error Handling**: Comprehensive try-catch with user-friendly messages

---

## [1.0.2] - 2024-02-02

### Added
- Initial stable release
- Discord Bot main system with n8n integration
- AI Assistant with role-based access control
- Moderation commands (kick, ban, mute, warn, help)
- Direct Message handling
- Permission-based access system
- Logging system (Winston)
- Configuration management via .env
- Comprehensive documentation suite
- Docker support

### Configuration
See [SETUP.md](docs/SETUP.md) for configuration details.

### Scripts
```bash
npm start           # Production
npm run dev         # Development
npm test            # Validate setup
npm run deploy-commands # Deploy slash commands
```

---

## Future Roadmap

### v2.1.0 (Released)
- [x] Database integration for persistent storage
- [x] Persistent rate limit and moderation storage
- [x] Message analytics and usage statistics

### v3.0.0 (Next Release - Planned Q2 2026)
- [ ] TypeScript Migration 🎯

### v3.1.0 (Planned Q3 2026)
- [ ] AI-driven automated moderation (activate existing commands)
- [ ] Manual moderation commands with prefix ```!```
- [ ] Content filtering and sentiment analysis
- [ ] Advanced logging dashboard (web interface)

### v3.2.0 (Planned Q3/Q4 2026)
- [ ] Multi-language support (i18n)
- [ ] User feedback and rating system
- [ ] Auto-Role

### v3.3.0 (Planned Q4 2026)
- [ ] Reactions based commands
- [ ] Scheduled messages and reminders
- [ ] Advanced role templates and permissions
- [ ] Leveling system

### v4.0.0 (Vision - 2027)
- [ ] Voice channel AI integration
- [ ] Web dashboard for bot management
- [ ] Plugin system for extensibility

## Known Issues

### v2.1.0
1. **PostgreSQL Connection** - If database is unavailable, bot falls back to in-memory storage (conversations lost on restart)
   - Solution: Ensure PostgreSQL is running and `DATABASE_URL` is correct
2. **Health Endpoint Port** - Default port 3000 may conflict with other services
   - Solution: Set custom `PORT` in .env
3. **Manual `/warn` Commands** - Slash command `/warn` still reserved for future automation
   - Current: Use prefix `!warn` in DM for manual warnings

### v2.0.0
1. **Prefix `!`** - Consider return to `/` moderation commands
2. **DM-only mode lacks channel-specific features** - Some users may want hybrid mode
   - Future: Consider optional channel whitelist in v3.x.x

## Deprecated

### v2.0.0
- ⚠️ **Guild/Channel Commands**: Bot no longer responds to commands in guild channels (breaking change)
  - Migration: Users must switch to Direct Messages
  - Timeline: Deprecated in 2.0.0, removed functionality
- ⚠️ **Manual Moderation Commands**: `/kick`, `/ban`, `/mute`, `/warn` disabled for manual use
  - Reason: Reserved for future automated moderation system
  - Timeline: Disabled in 2.0.0, will be re-enabled in 2.2.0 with automation
- ⚠️ **Node.js 20.x Support**: Minimum version is now 22.x LTS
  - Migration: Update runtime environment to Node.js 22.x
  - Timeline: Deprecated in 2.0.0

## Security

### v2.0.0 Security Enhancements
- ✅ **Rate Limiting**: 5 messages per minute per user prevents spam and abuse
- ✅ **PII Protection**: Message content never logged, only metadata (user ID, length, timestamp)
- ✅ **Input Validation**: Message length limits (4000 chars), sanitization, empty message blocking
- ✅ **Role Hierarchy Enforcement**: Moderation respects Discord role hierarchy
- ✅ **Retry Logic**: Exponential backoff prevents hammering n8n endpoint
- ✅ **CodeQL Analysis**: Automated security scanning in CI/CD
- ✅ **Dependabot**: Automated dependency updates with security patches
- ✅ **npm Audit**: Regular vulnerability scanning
- ✅ **Trivy Scanning**: Docker image vulnerability detection
- ✅ **Token Protection**: Credentials never logged or exposed in error messages

### v1.0.0 Security Measures
- Token never logged
- Sensitive data excluded from logs
- Role-based access control
- Permission verification
- Error messages don't expose internals

### Reporting Security Issues

**IMPORTANT:** Don't publish security issues publicly!

For detailed information on reporting security vulnerabilities and our security practices, please see our [SECURITY.md](SECURITY.md).

**Quick summary:**
1. **Report:** Use GitHub Security Advisory or email maintainers privately
2. **Response Time:** We aim to respond within 24-48 hours depending on severity
3. **Fix Timeline:** Critical vulnerabilities patched within 1-3 days
4. **Credit:** Security researchers will be credited in release notes and Security Hall of Fame

### Security Audit History
- **2026-02-16**: v2.1.0 security review completed
  - Database credentials secured in environment variables
  - Health endpoints expose minimal information
  - Conversation data encrypted at rest (PostgreSQL level)
  - PII handling reviewed for GDPR compliance
- **2026-02-09**: v2.0.0 security audit completed
  - Added rate limiting
  - Enhanced PII protection
  - Implemented automated security scanning

## Contributors

- **Project Owner**: whiteravens20
- **Maintainers**: [Add maintainers]
- **Contributors**: Thank you to all contributors!

### How to Contribute
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Code of Conduct
- Be respectful and inclusive
- Follow best practices
- Test before submitting PRs
- Document your changes

---

## Migration Guides

### Migrating from v2.0.x to v2.1.0

#### Quick Upgrade (Docker Users)

**1. Pull Latest Image**
```bash
docker-compose pull
docker-compose up -d
```

Database migrations run automatically on startup!

#### Manual Upgrade

**1. Update Code**
```bash
git pull origin main
npm install
```

**2. Setup PostgreSQL**

*Option A: Docker (Recommended)*
```bash
# PostgreSQL already configured in docker-compose.yml
docker-compose up -d postgres
```

*Option B: Existing PostgreSQL*
```bash
# Add to .env:
DATABASE_URL=postgresql://username:password@localhost:5432/discordbot
```

**3. Run Migrations**
```bash
# Automatic on first start
npm start

# Or manual:
npm run migrate:up
```

**4. Verify Health**
```bash
curl http://localhost:3000/health
```

**5. Test New Features**
```
# In Discord DM with bot:
!stats 7          # View 7-day statistics (admin)
!warnings         # View your warnings
!flushmemory      # Clear your conversation history
!warn @user test  # Issue a warning (admin)
```

#### New Environment Variables (Optional)

All database configuration is already set in docker-compose.yml. Only needed if using external PostgreSQL:

```bash
# .env additions (optional):
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PORT=3000  # Health check server port
```

#### What's New for Users

- **Conversation Memory**: Bot remembers last 20 messages (24H)
- **Persistent Warnings**: Warnings survive bot restarts
- **Statistics**: Admins can view usage with `!stats`
- **Better Uptime**: Rate limits and data persist across restarts

#### What's New for Admins

- `!stats [days]` - Usage statistics dashboard
- `!flushdb confirm` - Clear all database data
- `!flushmemory` - Clear conversation histories
- `/health` endpoint for monitoring

#### Rollback Plan

```bash
# Keep v2.0.x backup
docker tag your-bot:latest your-bot:v2.0.6-backup

# If issues, rollback:
# git checkout v2.0.6
# docker-compose up -d
```

#### Timeline
- **Upgrade Duration**: 2-5 minutes (automatic migrations)
- **Downtime**: ~30 seconds (rolling restart recommended)
- **Data Loss**: None (new features only)

---

### Migrating from v1.x to v2.0.0

#### Breaking Changes Checklist

**1. Update Node.js Runtime**
```bash
# Check current version
node --version

# Install Node.js 22.x LTS
# Visit: https://nodejs.org/ or use nvm:
nvm install 22
nvm use 22
```

**2. Switch to DM-Only Mode**
- ❌ Old: Bot responded in guild channels
- ✅ New: Bot only responds in Direct Messages
- **Action**: Inform users to DM the bot instead of using channels
- **Exception**: @mention in channels gives info message

**3. Update Moderation Workflow**
- ❌ Old: Manual moderation commands available
- ✅ New: Commands reserved for automated moderation
- **Action**: Use Discord's native moderation tools for manual actions
- **Future**: v2.2.0 will enable AI-driven automated moderation

**4. Update Dependencies**
```bash
npm install
npm audit fix
npm test
```

**5. Update Environment Variables**
```bash
# Add to .env if using coding mode:
BOT_PREFIX=!

# Verify configuration:
npm run test-config
```

**6. Test DM Functionality**
```bash
# Start bot
npm start

# Test in Discord:
# 1. @mention bot in channel → Should get DM instruction
# 2. Send DM to bot → Should get AI response
# 3. Send "!code write hello world" → Should route to coding LLM
# 4. Send 6 messages quickly → Should hit rate limit
```

**7. Update n8n Workflow**
- Add mode routing: check `$json.mode` field
- Route "code" to specialized LLM
- Route "chat" to general LLM
- See: [N8N_INTEGRATION.md](docs/N8N_INTEGRATION.md)

#### Configuration Changes
- No breaking environment variable changes
- All existing .env variables remain compatible
- New optional features use existing variables

#### Timeline
- **v1.0.2 → v2.0.0**: Major upgrade, allow testing period
- **Recommended**: Test in staging environment first
- **Rollback**: Keep v1.0.2 backup if needed

## License

MIT License - See [LICENSE](LICENSE) file

---

## Performance Metrics

### v2.1.0 Improvements
- **Database Queries**: ~2-10ms for simple queries (local PostgreSQL)
- **Conversation Retrieval**: ~5-15ms for 20 messages
- **Analytics Aggregation**: ~50-200ms for 90-day stats
- **Health Check Response**: < 10ms
- **Memory Usage**: ~80-120MB with database connections
- **Cleanup Jobs**: ~100-500ms per hourly run

### v2.0.0 Improvements
- **Rate Limiting Overhead**: < 1ms per message check (now database-backed)
- **Message Splitting**: ~2-5ms for 2000+ char messages
- **Memory Usage**: ~50-80MB base (Node.js 22.x)
- **n8n Retry Logic**: Max 7s delay (1s + 2s + 4s for 3 retries)
- **Docker Image Size**: ~180MB (alpine-based)

### Benchmarks
- **Cold Start**: ~3-5 seconds (with database connection)
- **Message Processing**: Average 300-500ms (including n8n roundtrip)
- **Rate Limit Check**: < 1ms (database-cached)
- **Database Connection Pool**: 10-20 connections max
- **Log File Growth**: ~5-10MB per day (moderate usage)

---

## How to Use This Changelog

### For Users
- Check **[Unreleased]** for upcoming features
- Review **Breaking Changes** before upgrading
- Read **Migration Guides** for version upgrades
- Check **Known Issues** for current limitations

### For Maintainers
- Update `[Unreleased]` section as you develop
- Move to versioned section when releasing
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Follow Keep a Changelog format
- Document breaking changes prominently

### Categories
- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

### Keep Chronological Order
- Newest versions at the top
- Within versions, group by category
- Within categories, most important first

---

## Versioning

Project uses [Semantic Versioning](https://semver.org/):

### Format: MAJOR.MINOR.PATCH

- **MAJOR** (X.0.0): Breaking changes
  - Example: v1.0.0 → v2.0.0 (DM-only mode, Node 22 required)
- **MINOR** (0.X.0): New features (backward compatible)
  - Example: v2.0.0 → v2.1.0 (conversation history)
- **PATCH** (0.0.X): Bug fixes
  - Example: v2.0.0 → v2.0.1 (fix rate limiter bug)

### Version History
- **v2.0.0** (2026-02-09): Major rewrite with DM-only, rate limiting, coding mode
- **v1.0.2** (2024-02-02): Initial stable release with basic features
- **v1.0.0** (2024-02-02): First public release

---

## Best Practices

### When to Update
- **Security Patches**: Update immediately (PATCH versions)
- **New Features**: Test in staging first (MINOR versions)
- **Breaking Changes**: Plan migration carefully (MAJOR versions)

### Update Workflow
1. Read CHANGELOG for your target version
2. Check Breaking Changes and Migration Guide
3. Update in staging/development environment
4. Run full test suite (`npm run test:all`)
5. Verify functionality with real Discord tests
6. Deploy to production during low-traffic period
7. Monitor logs for 24-48 hours

### Monitoring After Updates
```bash
# Watch logs for errors
tail -f logs/error.log

# Check rate limit hits
grep "Rate limit" logs/combined.log

# Verify n8n connectivity
grep "n8n workflow" logs/combined.log | tail -20

# Monitor memory usage
ps aux | grep node
```

### Backup Strategy
- Keep previous version Docker image
- Backup `.env` file before changes
- Tag git commits before deployments
- Keep logs from previous version

### Getting Help
- Check [FAQ.md](docs/FAQ.md) for common questions
- Review [USAGE_GUIDE.md](docs/USAGE_GUIDE.md) for detailed usage
- Check GitHub Issues for known problems
- Create new issue with detailed logs if needed

---

**Last Updated:** 2026-03-02  
**Current Version:** 3.0.0  
**Status:** Stable ✅  
**Repository:** [whiteravens20/exemplar](https://github.com/whiteravens20/exemplar)  
**License:** MIT - See [LICENSE](LICENSE) file