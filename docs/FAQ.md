# FAQ - Discord AI Assistant Bot

## 🤖 General Questions

### Q: Does the bot work on multiple servers?
**A:** One instance serves one server, the one in `DISCORD_SERVER_ID`. The assistant checks roles there and every moderation command acts there. For another server, run another instance with its own Discord application.

### Q: Can the bot work without n8n?
**A:** No. `N8N_WORKFLOW_URL` is required and the bot does not start without it. Any workflow works as long as it accepts the bot's payload and answers `{ "response": "..." }`, so the model and provider are your choice. See [N8N_INTEGRATION.md](N8N_INTEGRATION.md).

### Q: How much does it cost to run the bot?
**A:** The bot, PostgreSQL and a self-hosted n8n are free software; you pay for the machine they run on. The bundled workflows use local models through Ollama, which costs nothing per message. With a hosted model you pay that provider per token.

### Q: Can the bot be private (invite only)?
**A:** Yes. There is no public instance: you create your own Discord application. Turn "Public Bot" off in the Developer Portal and only you can add it to a server.

## 🔧 Setup & Configuration

### Q: Where to get Discord Token?
**A:**
1. Go to [Discord Developer Portal](https://discord.com/developers)
2. Open your application
3. Go to "Bot" tab
4. Click "Reset Token" (the token is shown once)
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

### Q: What if my token leaks?
**A:** If someone saw the token:
1. Go to [Discord Developer Portal](https://discord.com/developers)
2. Click "Reset Token"
3. Copy new token to `.env`
4. Restart bot

## 🚀 Running & Deployment

### Q: Bot won't start
**A:** Check:
1. `.env` - a missing required variable stops the bot with `Missing required configuration: <name>`
2. The log: `docker compose logs discord-bot`, or `logs/combined.log` without Docker
3. Without Docker: `npm install` and `npm run build` have been run
4. `bash scripts/test-bot.sh` checks the Node.js version, the dependencies and the type check

### Q: How to run on VPS/Server?
**A:** With Docker Compose, see [DOCKER_SETUP.md](DOCKER_SETUP.md). Without Docker, build once and keep the process alive with PM2:
```bash
npm install
npm run build
npm run migrate:up
npm install -g pm2
pm2 start dist/index.js --name "discord-bot"
pm2 startup
pm2 save
```

### Q: How to run in Docker?
**A:**
```bash
docker compose up -d
```
Compose starts PostgreSQL, applies the migrations and starts the bot. See [DOCKER_SETUP.md](DOCKER_SETUP.md).

### Q: What does `npm run dev` do?
**A:** It builds the bot and starts it, then rebuilds and restarts it whenever a file under `src/` changes. It uses Node's own watch mode.

## 💬 AI Assistant Features

### Q: How does AI Assistant know context?
**A:** In two ways:
1. The bot stores the last 20 exchanges of each user for 24 hours and sends them to n8n with every message, as `conversationContext`.
2. The bundled workflow keeps its own memory per user in PostgreSQL (the last 20 messages) and uses that.

`/flushmemory` clears the bot's copy for the user who runs it, and the workflow's memory too when n8n keeps it in the bot's database. The assistant only sees the DM conversation, never the messages in server channels.

### Q: Can I integrate ChatGPT?
**A:** Yes. In the n8n workflow, replace the Ollama model node with the chat-model node of your provider and connect it to the agent's **Chat Model** input. The chat agent's model must support tool calling.

### Q: Can bot store conversations?
**A:** It does: see the context question above. The retention is 24 hours on the bot's side; an hourly job removes older rows.

### Q: What's the message limit at once?
**A:** A DM to the assistant can be up to 4000 characters. Discord limits a message to 2000 characters, so the bot splits longer answers.

### Q: Is there a limit on how often I can write?
**A:** 5 messages per minute per user. The bot tells you how long to wait.

## 🛡️ Moderation

### Q: Are moderation commands automatic?
**A:** The slash commands are manual. Two things are automatic:
- **Escalation**: 3 active warnings mute the member, 100 warnings in total ban them (both configurable).
- **AI moderation** (optional): messages in the channels you enrol are sent to a second n8n workflow, which answers `allow`, `warn`, `timeout` or `delete`. See [AI_MODERATION.md](AI_MODERATION.md).

### Q: Can I add more moderation commands?
**A:** Yes! Create a new file in `src/slashcommands/` following `kick.ts`, add its texts to every file in `src/locales/` and register it in `src/index.ts`.

### Q: What's the timeout limit?
**A:** `/mute` takes a duration such as `30s`, `10m`, `2h` or `1d`, up to Discord's maximum of 28 days.

## 🔐 Security & Permissions

### Q: Can bot see private channels?
**A:** Only the channels its role may view. AI moderation only analyses the channels listed in `AI_MOD_INCLUDE_CHANNELS`. Limit the bot's permissions to what [SETUP.md](SETUP.md) lists.

### Q: Can I disable AI for some users?
**A:** Yes. Put the roles that may use the assistant in `ALLOWED_ROLES_FOR_AI`; everyone else gets the no-permission reply. With the variable empty, everyone may use it.

## 🐛 Troubleshooting

### Q: Bot responds with delay
**A:** Causes:
- A local model that has to be loaded first: the first answer after a pause is the slowest
- Slow n8n workflow - check the execution in n8n
- Slow or rate-limited model provider

The bot waits up to two minutes for an answer and says so when it gives up.

### Q: Slash commands don't work
**A:**
1. Run them in a DM with the bot; in a server channel the bot only points you to DMs
2. Restart the bot (commands are registered with Discord on every start) and give Discord a few minutes
3. Check that the bot was invited with the `applications.commands` scope

### Q: DM doesn't send to n8n
**A:** The bot tells apart an unreachable n8n, a timeout, a missing workflow (404) and a wrong key (401/403) and replies accordingly. The table in [N8N_INTEGRATION.md](N8N_INTEGRATION.md#troubleshooting) lists the likely cause of each.

### Q: "You don't have permission"
**A:**
1. Check if you have role from `ALLOWED_ROLES_FOR_AI`
2. If empty - everyone can
3. Check if role ID is correct (no spaces)

### Q: Bot doesn't respond to anything
**A:**
1. Check if bot is online
2. Check that **Message Content Intent** and **Server Members Intent** are enabled in the Developer Portal
3. Check logs: `docker compose logs -f discord-bot`, or `tail -f logs/combined.log` without Docker
4. Check if bot has "Send Messages" permission

## 📊 Monitoring

### Q: How to monitor bot?
**A:**
```bash
# Health: 200 when the database answers, 503 otherwise
curl http://localhost:3000/health

# Live log (Docker)
docker compose logs -f discord-bot

# Live log and errors only (without Docker)
tail -f logs/combined.log
tail -f logs/error.log
```
The optional dashboard shows moderation actions and AI decisions; see [DASHBOARD.md](DASHBOARD.md).

### Q: How to debug slow response?
**A:**
1. Open the execution in n8n and see which node takes long
2. Test the webhook with curl (examples in [N8N_INTEGRATION.md](N8N_INTEGRATION.md))
3. `/stats` shows the average response time

## 🆘 Getting Help

### Q: Where can I ask for help?
**A:**
1. Check [Project Issues](https://github.com/whiteravens20/exemplar/issues)
2. Read documentation (README.md, SETUP.md)
3. Check the log for errors
4. Create new Issue with details

### Q: How to report a bug?
**A:** Open an issue with the bug report template and add:
- Detailed description
- Steps to reproduce
- Expected vs actual behavior
- The relevant log lines
- Your configuration without secrets

Security problems go through [SECURITY.md](../SECURITY.md), not public issues.

### Q: Can I suggest a feature?
**A:** Yes! Open an issue with the feature request template and describe the idea.

## 📚 Learning Resources

### Q: Where to learn Discord.js?
**A:** [discord.js documentation](https://discord.js.org/)

### Q: Where to learn n8n?
**A:** [n8n documentation](https://docs.n8n.io/)

---

**Didn't find answer?** Create Issue on [GitHub](https://github.com/whiteravens20/exemplar/issues)
