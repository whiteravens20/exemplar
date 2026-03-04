# Discord AI Assistant Bot - Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Discord Setup
- [ ] Application created on Discord Developer Portal
- [ ] Bot token copied and secure
- [ ] Client ID registered
- [ ] Bot added to server with appropriate permissions
- [ ] Slash commands can be created (required permissions)

### 2. n8n Setup
- [ ] n8n instance available (cloud or self-hosted)
- [ ] Webhook trigger configured
- [ ] Workflow tested with curl
- [ ] Response format correct: `{ response: "..." }`
- [ ] Workflow URL copied

### 3. Environment Variables
- [ ] `.env` file created (copied from `.env.example`)
- [ ] `DISCORD_TOKEN` set
- [ ] `DISCORD_CLIENT_ID` set
- [ ] `DISCORD_SERVER_ID` set
- [ ] `N8N_WORKFLOW_URL` set
- [ ] `ALLOWED_ROLES_FOR_AI` configured (if needed)
- [ ] `HARDCODED_MENTION_RESPONSE` customized

### 4. Role Configuration
- [ ] Discord roles identified
- [ ] Role IDs copied (for `ALLOWED_ROLES_FOR_AI`)
- [ ] Users assigned to proper roles
- [ ] Admins can execute moderation commands

### 5. Node.js & Dependencies
- [ ] Node.js 22+ installed
- [ ] Dependencies installed: `npm install`
- [ ] Configuration test passed: `npm run test-config`
- [ ] All required variables loaded

### 6. Logging & Monitoring
- [ ] `logs/` folder will be created automatically
- [ ] Ensure application has write access
- [ ] Configure log rotation (if needed)
- [ ] Log backups (for production)

## 🚀 Deployment Steps

### Local Development
```bash
# 1. Clone repo
git clone <repo>
cd discord-ai-bot

# 2. Installation
npm install

# 3. Configuration
cp .env.example .env
# Edit .env

# 4. Test
npm run test-config

# 5. Run
npm run dev
```

### Production (Linux Server)

#### Option 1: PM2 (Recommended)
```bash
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

#### Option 2: Systemd Service
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
WorkingDirectory=/path/to/discord-ai-bot
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

#### Option 3: Docker

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY .env .

CMD ["node", "dist/index.js"]
```

```bash
docker build -t discord-bot .
docker run -d --name discord-bot discord-bot
```

### Cloud Deployment (Heroku/Railway/etc)

1. Add `Procfile`:
```
worker: node dist/index.js
```

2. Configure environment variables in panel
3. Deploy application

## ✔️ Post-Deployment Verification

### 1. Bot Connectivity
- [ ] Bot appears online on Discord
- [ ] Bot status changes every 30 seconds
- [ ] No errors in startup logs

### 2. Mention Response Test
```
In Discord publicly: @BotName
Bot should respond in 1-2 seconds
```

### 3. DM Response Test (with authorized role)
```
Send PM: /help
Bot should send query to n8n
n8n should return response
```

### 4. DM Denied Test (without authorization - if set)
```
Send PM from unauthorized account: test
Bot should return RESTRICTED_RESPONSE
```

### 5. Slash Commands Test
```
/kick @user reason
/ban @user reason
/mute @user 60 reason
/warn @user reason
/help
```

### 6. Log Inspection
```bash
# Check if logs are created
ls -lah logs/
ls -lah *.log

# Check recent logs
tail -20 combined.log
```

## 📊 Monitoring Checklist

### Daily
- [ ] Check `combined.log` for warnings
- [ ] Check `error.log` for errors
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
tail -20 error.log

# 3. Type check the project
npm run typecheck

# 4. Ensure bot has Intent permissions
```

### n8n workflow doesn't respond
```bash
# 1. Test curl
curl -X POST $N8N_WORKFLOW_URL \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'

# 2. Check n8n logs
# 3. Ensure webhook trigger is active
# 4. Check response format: { response: "..." }
```

### Commands don't work
```bash
# 1. Re-deploy slash commands
npm run deploy-commands

# 2. Restart bot
pkill -f "node dist/index.js"
npm start

# 3. Check permissions
# Bot must have Administrator or specific moderation perms
```

### Memory leak
```bash
# Monitor memory
watch -n 1 ps aux | grep node

# If problem - restart bot
systemctl restart discord-bot
# lub
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
- [ ] Change log updated
- [ ] Known issues documented

---

**Checklist Version:** 1.2
**Last Updated:** 2026-03-02
**Status:** Ready for deployment ✅
