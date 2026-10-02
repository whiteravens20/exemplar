# ⚡ Quick Start Guide

Fast way to run Discord Bot with n8n and PostgreSQL.

## 5 Minutes Setup (Docker - Recommended)

### 1️⃣ Clone Repo
```bash
git clone https://github.com/whiteravens20/exemplar.git
cd exemplar
```

### 2️⃣ Create the Discord application
1. Go to https://discord.com/developers/applications
2. Click "New Application" and name it
3. Go to "Bot" → "Reset Token" and copy the token (it is shown once)
4. On the same page enable **Server Members Intent** and **Message Content Intent**
5. Copy the Application ID from "General Information"
6. Invite the bot to your server with the `bot` and `applications.commands` scopes; the permissions it needs are listed in [SETUP.md](SETUP.md)

### 3️⃣ Configure n8n
1. In your n8n, import [`assistant-workflow.n8n.json`](assistant-workflow.n8n.json) (Workflows → Import from File)
2. Set its credentials as described in [N8N_INTEGRATION.md](N8N_INTEGRATION.md)
3. Activate the workflow and copy the webhook's Production URL

### 4️⃣ Setup .env
```bash
cp .env.example .env
nano .env
```

Fill in:
```env
DISCORD_TOKEN=your_token_here
DISCORD_CLIENT_ID=your_application_id
DISCORD_SERVER_ID=your_server_id
N8N_WORKFLOW_URL=https://your-n8n.com/webhook/...
# The secret the webhook's Header Auth credential holds (openssl rand -hex 32)
N8N_API_KEY=your_shared_secret
# Role IDs allowed to use the assistant; empty = everyone
ALLOWED_ROLES_FOR_AI=

# Database: Docker Compose only needs a password, the rest has defaults
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
  "status": "ok",
  "uptime": 12.3,
  "timestamp": "2026-02-16T...",
  "database": "connected"
}
```

---

## Manual Setup (Without Docker)

Needs Node.js 22+, npm 11+ and PostgreSQL 14+.

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
npm run build
```

### 3️⃣ Configure .env
```bash
cp .env.example .env
nano .env
```

Fill in the Discord and n8n values as above, and the database connection:
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
→ Bot replies that it answers in DMs
```

### Direct Message (5+ seconds)
```
Send DM to bot: hello
→ Bot sends to n8n
→ n8n answers, with the conversation so far as memory
→ Bot returns response
```

### Slash Commands (run in DMs with the bot)
```
/help                → Commands you can use
/code message:...    → Ask the coding model
/flushmemory         → Clear conversation history
/warnings            → View your warnings
/warn user:@user reason:...  → Issue warning (moderator)
/stats days:7        → View 7-day usage statistics (admin)
```

---

## Troubleshooting

### Bot not online?
```bash
# Docker: Check container logs
docker compose logs discord-bot

# Docker: Check all services
docker compose ps
```
A missing required setting stops the bot at startup with
`Missing required configuration: <name>` in the log.

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
docker compose logs -f discord-bot
```

### Slash commands not working?
Commands are registered with Discord on every start, so restart the bot
(`docker compose restart discord-bot` or `npm start`) and give Discord a few
minutes to show them. They run in DMs with the bot; in a server channel the
bot only points you to DMs.

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
