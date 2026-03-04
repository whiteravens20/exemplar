# FAQ - Discord AI Assistant Bot

## 🤖 General Questions

### Q: Does the bot work on multiple servers?
**A:** The bot can be on multiple servers, but the AI Assistant is limited to one server (configured in `DISCORD_SERVER_ID`). To use a different server, change the variable.

### Q: Can the bot work without n8n?
**A:** Currently requires n8n for DM processing. However, you can:
- Return hardcoded responses
- Integrate other APIs through n8n
- Extend code to use different backend

### Q: How much does it cost to run the bot?
**A:** 
- Discord Bot - free
- n8n self-hosted - free
- n8n cloud - from $25/month
- Hosting (VPS) - from $3/month
- OpenAI API - per token, from $0.01/1K tokens

### Q: Can the bot be private (invite only)?
**A:** Yes, configure bot token as private and don't share the invite link publicly. Discord manages access.

## 🔧 Setup & Configuration

### Q: Where to get Discord Token?
**A:**
1. Go to [Discord Developer Portal](https://discord.com/developers)
2. Open your bot
3. Go to "Bot" tab
4. Click "Reset Token" if you don't see it
5. Copy token to `.env`

**IMPORTANT:** Never commit token to Git!

### Q: How to find Role ID?
**A:**
1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on role in Server Settings > Roles
3. Click "Copy Role ID"
4. Paste to `ALLOWED_ROLES_FOR_AI` (comma-separated)

### Q: How to find Server ID?
**A:**
1. Enable Developer Mode
2. Right-click on server name
3. Click "Copy Server ID"

### Q: What if I forget to change TOKEN?
**A:** If someone saw the token:
1. Go to [Discord Developer Portal](https://discord.com/developers)
2. Click "Reset Token"
3. Copy new token to `.env`
4. Restart bot

## 🚀 Running & Deployment

### Q: Bot won't start
**A:** Check:
1. `npm install` - install dependencies
2. `.env` - check all variables are there
3. `npm run test-config` - check configuration
4. Logs - check `combined.log` for errors

### Q: How to run on VPS/Server?
**A:** Use PM2:
```bash
npm install -g pm2
pm2 start dist/index.js --name "discord-bot"
pm2 startup
pm2 save
```

### Q: How to run in Docker?
**A:** 
```bash
docker build -t discord-bot .
docker run -d --env-file .env discord-bot
```

### Q: What is "nodemon"?
**A:** It's a development tool. Automatically restarts bot when you change code. Used by `npm run dev`.

## 💬 AI Assistant Features

### Q: How does AI Assistant know context?
**A:** Currently each message is independent. To have context:
1. Keep conversation history in n8n or database
2. Send history with new message
3. LLM (OpenAI, etc.) will have context

### Q: Can I integrate ChatGPT?
**A:** Yes! Edit n8n workflow:
1. Add "HTTP Request" node for OpenAI API
2. Send prompt to OpenAI
3. Return response in format `{ response: "..." }`

### Q: Can bot store conversations?
**A:** Yes, in n8n you can:
1. Save to database
2. Use table lookup
3. Build context from history
4. Send to LLM with context

### Q: What's the message limit at once?
**A:** Discord limit: 2000 characters. Bot automatically splits longer messages.

## 🛡️ Moderation

### Q: Are moderation commands automatic?
**A:** No, these are manual slash commands for moderators. To make automatic:
- Add event handler on `MessageCreate`
- Check if message content broke rules
- Execute kick/ban/mute automatically

### Q: Can I add more moderation commands?
**A:** Yes! Create new file in `src/slashcommands/` and follow pattern from `kick.ts`.

### Q: What's the timeout limit?
**A:** Discord timeout: up to 28 days. Bot sets in minutes, so max 40320 minutes (28 days).

## 🔐 Security & Permissions

### Q: Can bot see private channels?
**A:** Yes, if it has permissions. Limit bot permissions to minimum needed.

### Q: Can I disable AI for some users?
**A:** Yes:
1. Create role without access
2. Set in `.env` which roles are allowed
3. Remove disallowed roles from users

### Q: Can AI know message history?
**A:** By default no. You can add integration with message history in n8n.

## 🐛 Troubleshooting

### Q: Bot responds with delay
**A:** Causes:
- Slow n8n workflow - optimize
- Slow LLM API - check OpenAI status
- Network lag - check ping
- Bot memory - restart bot

### Q: Slash commands don't work
**A:**
1. Wait 5-60 minutes for Discord synchronization
2. Re-deploy: `npm run deploy-commands`
3. Restart bot
4. Check if bot has Permission "applications.commands"

### Q: DM doesn't send to n8n
**A:**
1. Check `N8N_WORKFLOW_URL` in `.env`
2. Check if webhook is active in n8n
3. Test webhook URL with curl
4. Check n8n logs

### Q: "You don't have permission"
**A:**
1. Check if you have role from `ALLOWED_ROLES_FOR_AI`
2. If empty - everyone can
3. Check if role ID is correct (no spaces)

### Q: Bot doesn't respond to anything
**A:**
1. Check if bot is online
2. Sprawdzaj czy bot vidzi channel
3. Check logs: `tail -f combined.log`
4. Check if bot has "Send Messages" permission

## 📊 Monitoring

### Q: How to monitor bot?
**A:**
```bash
# Logi live
tail -f combined.log

# Błędy
tail -f error.log

# PM2 monitoring
pm2 monit

# Memory/CPU
ps aux | grep node
```

### Q: How to debug slow response?
**A:**
1. Check which steps take long
2. Add logging in n8n workflow
3. Test each API endpoint separately
4. Check timeout settings

## 🆘 Getting Help

### Q: Where can I ask for help?
**A:**
1. Check [Project Issues](https://github.com/whiteravens20/exemplar/issues)
2. Read documentation (README.md, SETUP.md)
3. Check `combined.log` for errors
4. Create new Issue with details

### Q: How to report a bug?
**A:** 
1. Create Issue with `[BUG]` in title
2. Add:
   - Detailed description
   - Steps to reproduce
   - Expected vs actual behavior
   - Logs from `combined.log`
   - `.env` (without sensitive data)

### Q: Can I suggest a feature?
**A:** Yes! Create Issue with `[FEATURE]` in title and describe idea.

## 📚 Learning Resources

### Q: Where to learn Discord.js?
**A:** [discord.js documentation](https://discord.js.org/)

### Q: Where to learn n8n?
**A:** [n8n documentation](https://docs.n8n.io/)

### Q: Where to learn OpenAI API?
**A:** [OpenAI API docs](https://platform.openai.com/docs)

### Q: Are there tutorials?
**A:** Check YouTube, Dev.to, Medium for guides.

---

**Didn't find answer?** Create Issue on [GitHub](https://github.com/whiteravens20/exemplar/issues)

**Last Updated:** 2024-02-02
