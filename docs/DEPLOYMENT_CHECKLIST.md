# Discord AI Assistant Bot - Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Discord Setup
- [ ] Application created on Discord Developer Portal
- [ ] Bot token copied and secure
- [ ] Client ID registered
- [ ] **Server Members Intent** and **Message Content Intent** enabled on the Bot page
- [ ] Bot invited with the `bot` and `applications.commands` scopes and the permissions listed in [SETUP.md](SETUP.md)
- [ ] Bot's role placed above the roles of the members it moderates and the roles it hands out

### 2. n8n Setup
- [ ] n8n instance available (cloud or self-hosted)
- [ ] Assistant workflow imported and its credentials set (see [N8N_INTEGRATION.md](N8N_INTEGRATION.md))
- [ ] Workflow active and tested with curl
- [ ] Response format correct: `{ response: "..." }`
- [ ] Production webhook URL copied

### 3. Environment Variables
- [ ] `.env` file created (copied from `.env.example`)
- [ ] `DISCORD_TOKEN` set
- [ ] `DISCORD_CLIENT_ID` set
- [ ] `DISCORD_SERVER_ID` set
- [ ] `N8N_WORKFLOW_URL` set
- [ ] `N8N_API_KEY` set to the secret in the webhook's Header Auth credential
- [ ] `DB_PASSWORD` set
- [ ] `ALLOWED_ROLES_FOR_AI` configured (if needed)
- [ ] `MOD_LOG_CHANNEL_ID` set (if moderation actions should be logged to a channel)
- [ ] `BOT_LANGUAGE` set to the server's language
- [ ] `HARDCODED_MENTION_RESPONSE` / `RESTRICTED_RESPONSE` customized (optional)

### 4. Role Configuration
- [ ] Discord roles identified
- [ ] Role IDs copied (for `ALLOWED_ROLES_FOR_AI`)
- [ ] Users assigned to proper roles
- [ ] Admins can execute moderation commands

### 5. Node.js & Dependencies (without Docker)
- [ ] Node.js 24+ and npm 11+ installed
- [ ] Dependencies installed: `npm install`
- [ ] Project built: `npm run build`
- [ ] Migrations applied: `npm run migrate:up`

### 6. Logging & Monitoring
- [ ] `logs/` folder will be created automatically; under Docker Compose the files are in the `bot_logs` volume
- [ ] Ensure application has write access (otherwise the bot logs to the console only and says so at startup)
- [ ] Log files rotate on their own: 10 MB each, five kept
- [ ] Log backups (for production)

## 🚀 Deployment Steps

### Local Development
```bash
# 1. Clone repo
git clone https://github.com/whiteravens20/exemplar.git
cd exemplar

# 2. Installation
npm install

# 3. Configuration
cp .env.example .env
# Edit .env

# 4. Database
npm run build
npm run migrate:up

# 5. Run (rebuilds and restarts on changes)
npm run dev
```

### Production (Linux Server)

#### Option 1: Docker Compose (Recommended)
```bash
docker compose up -d
docker compose logs -f discord-bot
```

Starts PostgreSQL, applies the migrations and starts the bot. See [DOCKER_SETUP.md](DOCKER_SETUP.md).

#### Option 2: PM2
```bash
# Build and prepare the database
npm install
npm run build
npm run migrate:up

# Install PM2
npm install -g pm2

# Start application
pm2 start dist/index.js --name "discord-bot"

# Auto-start on reboot
pm2 startup
pm2 save

# Monitoring
pm2 monit
pm2 logs discord-bot
```

#### Option 3: Systemd Service
Build the project (`npm install && npm run build && npm run migrate:up`) in the working directory first.

```bash
# Create service file
sudo nano /etc/systemd/system/discord-bot.service
```

```ini
[Unit]
Description=Discord AI Assistant Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/exemplar
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable discord-bot
sudo systemctl start discord-bot

# Status
sudo systemctl status discord-bot
sudo journalctl -u discord-bot -f
```

### Cloud Deployment (Heroku/Railway/etc)

1. Add `Procfile`:
```
worker: node dist/index.js
```

2. Configure environment variables in panel
3. Provide a PostgreSQL database and run `npm run build` and `npm run migrate:up` in the build step
4. Deploy application

## ✔️ Post-Deployment Verification

### 1. Bot Connectivity
- [ ] Bot appears online on Discord
- [ ] Bot status changes every 5 minutes
- [ ] No errors in startup logs
- [ ] `curl http://localhost:3000/health` answers 200 with `"database":"connected"`

### 2. Mention Response Test
```
In Discord publicly: @BotName
Bot should respond in 1-2 seconds
```

### 3. DM Response Test (with authorized role)
```
Send DM: hello
Bot should send query to n8n
n8n should return response
```

### 4. DM Denied Test (without authorization - if set)
```
Send PM from unauthorized account: test
Bot should reply that you have no permission (RESTRICTED_RESPONSE, if set)
```

### 5. Slash Commands Test
Run them in a DM with the bot, against a test account:
```
/help
/warn user:<user> reason:<text>
/mute user:<user> duration:10m reason:<text>
/unmute user:<user>
/kick user:<user> reason:<text>
/ban user:<user> reason:<text>
/unban user_id:<id>
```

### 6. Log Inspection
```bash
# Docker Compose
docker compose logs --tail 20 discord-bot
docker compose exec discord-bot ls -la logs/

# Without Docker
ls -lah logs/
tail -20 logs/combined.log
```

## 📊 Monitoring Checklist

### Daily
- [ ] Check `logs/combined.log` for warnings
- [ ] Check `logs/error.log` for errors
- [ ] Ensure bot is online
- [ ] n8n workflow has no issues

### Weekly
- [ ] Check disk space for logs
- [ ] Check Discord rate limits
- [ ] Review errors in logs
- [ ] Test manual commands

### Monthly
- [ ] Backup logs
- [ ] Update dependencies: `npm outdated`
- [ ] Check security advisories: `npm audit`
- [ ] Optimize performance

## 🚨 Troubleshooting

### Bot won't connect
```bash
# 1. Check token
echo $DISCORD_TOKEN | head -c 20

# 2. Check logs
docker compose logs --tail 20 discord-bot   # or: tail -20 logs/error.log

# 3. Check the installation (Node.js version, dependencies, type check)
bash scripts/test-bot.sh

# 4. Ensure the Server Members and Message Content intents are enabled
```

### n8n workflow doesn't respond
```bash
# 1. Test curl
curl -X POST $N8N_WORKFLOW_URL \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $N8N_API_KEY" \
  -d '{"userId":"test-user","userName":"tester","message":"test","serverId":"0","mode":"chat","timestamp":"2026-01-01T00:00:00Z","platform":"discord"}'

# 2. Check n8n logs
# 3. Ensure webhook trigger is active
# 4. Check response format: { response: "..." }
```

### Commands don't work
```bash
# 1. Restart bot (slash commands are registered with Discord on every start)
docker compose restart discord-bot   # or restart the PM2 / systemd service

# 2. Run the command in a DM with the bot: in a server channel it only
#    points you to DMs

# 3. Check permissions
# The bot needs the permissions listed in SETUP.md and a role above the
# member it acts on; the moderator needs the matching Discord permission
```

### Memory leak
```bash
# Monitor memory
watch -n 1 ps aux | grep node

# If problem - restart bot
systemctl restart discord-bot
# or
pm2 restart discord-bot
```

## 🔒 Production Security

- [ ] .env never in repo
- [ ] Regular configuration backups
- [ ] Restricted server access
- [ ] Firewall rules configured
- [ ] Regular security updates
- [ ] API keys rotated regularly
- [ ] Audit logging enabled

## 📈 Performance Optimization

### Bot Side
- [ ] Async operations for DB queries
- [ ] Caching for role permissions
- [ ] Batch processing for large responses
- [ ] Rate limit handling

### n8n Side
- [ ] Optimize workflow performance
- [ ] Use database caching
- [ ] Set reasonable timeouts
- [ ] Monitor execution times

## 🆘 Emergency Contacts

- Discord Support: support.discord.com
- n8n Community: community.n8n.io
- Bot Maintainer: [Your contact info]

## 📝 Documentation

- [ ] README.md updated
- [ ] SETUP.md complete
- [ ] N8N_INTEGRATION.md ready
- [ ] Known issues documented
