# ⚡ Quick Start Guide

Fast way to run Discord Bot with n8n and PostgreSQL.

## 5 Minutes Setup (Docker - Recommended)

### 1️⃣ Clone Repo
```bash
git clone https://github.com/whiteravens20/exemplar.git
cd exemplar
```

### 2️⃣ Get Discord Token
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name: "AI Assistant" (or any name)
4. Go to "Bot" → "Add Bot"
5. Copy token to notepad

### 3️⃣ Configure n8n
1. Open https://n8n.io (cloud or self-hosted)
2. Create new workflow
3. Add "Webhook" trigger
4. Copy webhook URL

### 4️⃣ Setup .env
```bash
cp .env.example .env
nano .env
```

Fill in:
```env
DISCORD_TOKEN=your_token_here
DISCORD_CLIENT_ID=your_client_id
DISCORD_SERVER_ID=your_server_id
N8N_WORKFLOW_URL=https://your-n8n.com/webhook/...

# Database (already configured in docker-compose.yml)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=discord_bot
DB_USER=bot_user
DB_PASSWORD=change_me_in_production
```

### 5️⃣ Run with Docker
```bash
docker compose up -d
```

✅ Bot + Database should be online!
✅ Migrations run automatically!

### 6️⃣ Verify Health
```bash
curl http://localhost:3000/health
```

Should return:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-02-16T..."
}
```

---

## Manual Setup (Without Docker)

### 1️⃣ Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql
brew services start postgresql

# Create database
createdb discord_bot
```

### 2️⃣ Clone and Install
```bash
git clone https://github.com/whiteravens20/exemplar.git
cd exemplar
npm install
```

### 3️⃣ Configure .env
```bash
cp .env.example .env
nano .env
```

Update database connection:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=discord_bot
DB_USER=your_username
DB_PASSWORD=your_password
```

### 4️⃣ Run Migrations
```bash
npm run migrate:up
```

### 5️⃣ Start Bot
```bash
npm start
```

---

## Test Bot

### Public Mention (1-2 seconds)
```
@BotName
→ Bot responds with hardcoded message
```

### Direct Message (5+ seconds)
```
Send DM to bot: hello
→ Bot sends to n8n
→ n8n processes with conversation context
→ Bot returns response
```

### Admin Commands (DM only)
```
!stats 7        → View 7-day usage statistics (admin)
!warn @user     → Issue warning (admin/moderator)
!warnings       → View your warnings (all users)
!flushmemory    → Clear conversation history
```

---

## Troubleshooting

### Bot not online?
```bash
# Check configuration
npm run test-config

# Docker: Check container logs
docker compose logs bot

# Docker: Check all services
docker compose ps
```

### Database connection issues?
```bash
# Check health endpoint
curl http://localhost:3000/health

# Docker: Check PostgreSQL logs
docker compose logs postgres

# Docker: Restart services
docker compose restart
```

### No response on DM?
```bash
# Check logs
tail -f logs/combined.log

# Docker: Stream logs
docker compose logs -f bot
```

### Slash commands not working?
```bash
npm run deploy-commands
npm start
```
Wait 5 minutes for Discord synchronization.

### Health check failing?
```bash
# Test database connection
psql -h localhost -U bot_user -d discord_bot

# Check if migrations ran
npm run migrate:up
```

---

## Next Steps

1. Read [DATABASE.md](DATABASE.md) for database details
2. Read [SETUP.md](SETUP.md) for complete setup
3. Read [N8N_INTEGRATION.md](N8N_INTEGRATION.md) for workflows
4. Configure role-based access (if needed)
5. Deploy to production (see [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md))
6. Monitor with health endpoints

---

## Get Help

- 📖 [FAQ.md](FAQ.md) - Common questions
- 💾 [DATABASE.md](DATABASE.md) - Database setup and troubleshooting
- 📚 [SETUP.md](SETUP.md) - Detailed setup
- 🔧 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Code details
- ✅ [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Production

---

**That's it! You're ready to go! 🚀**
