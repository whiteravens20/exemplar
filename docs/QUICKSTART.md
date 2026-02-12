# ⚡ Quick Start Guide

Fast way to run Discord Bot with n8n.

## 5 Minutes Setup

### 1️⃣ Clone Repo
```bash
git clone https://github.com/whiteravens20/exemplar.git
cd exemplar
npm install
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
```

### 5️⃣ Run
```bash
npm start
```

✅ Bot should be online!

---

## Test Bot

### Public Mention (1-2 seconds)
```
@BotName
→ Bot responds with hardcoded message
```

### Direct Message (5+ seconds)
```
Send PM to bot: hello
→ Bot sends to n8n
→ n8n processes
→ Bot returns response
```

### Moderation Command
```
/kick @user spam
→ User kicked
```

---

## Troubleshooting

### Bot not online?
```bash
npm run test-config
```
Check if all variables are set.

### No response on PM?
```bash
tail -f combined.log
```
Check logs for errors.

### Slash commands not working?
```bash
npm run deploy-commands
npm start
```
Wait 5 minutes for Discord synchronization.

---

## Next Steps

1. Read [SETUP.md](SETUP.md) for details
2. Read [N8N_INTEGRATION.md](N8N_INTEGRATION.md) for workflows
3. Configure role-based access (if needed)
4. Deploy to server (VPS)
5. Monitor logs

---

## Get Help

- 📖 [FAQ.md](FAQ.md) - Common questions
- 📚 [SETUP.md](SETUP.md) - Detailed setup
- 🔧 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Code details
- ✅ [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Production

---

**That's it! You're ready to go! 🚀**
