# 🚀 Setup Guide - Discord AI Assistant Bot

## Configuration Steps

> **Deployment model:** This is a self-hosted, single-server bot. You create your
> own Discord application and run one instance for one server — there is no public
> bot. The app is guild-installed and `DISCORD_SERVER_ID` is required; all
> moderation commands act on that configured server.

### 1. Preparing Discord Application

#### A. Creating Application
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Provide a name (e.g., "AI Assistant Bot")
4. Accept Terms of Service and click "Create"

#### B. Creating Bot
1. On the left side, go to "Bot"
2. Under "TOKEN" click "Reset Token", then copy the token and save it somewhere safe (this is your `DISCORD_TOKEN`; it is shown only once)
3. Under "Privileged Gateway Intents" enable **Server Members Intent** and **Message Content Intent**. Without them the bot cannot check roles or read messages.

#### C. Configuring Permissions
1. Go to "OAuth2" > "URL Generator"
2. Check the following **scopes**:
   - `bot`
   - `applications.commands`

3. Check the following **permissions**:
   - Text Permissions:
     - Send Messages
     - Read Message History
     - Read Messages/View Channels
     - Add Reactions
   - General:
     - Manage Roles (reaction roles; see [REACTION_ROLES.md](REACTION_ROLES.md))
   - Moderation:
     - Kick Members
     - Ban Members
     - Timeout Members
     - Manage Messages (only for AI moderation, to delete messages; see [AI_MODERATION.md](AI_MODERATION.md))

4. Copy the generated URL and open it in your browser to add the bot to your server
5. In Server Settings > Roles, keep the bot's role above the roles of the members it should moderate and above the roles it hands out

#### D. Retrieving Application ID and Server ID
- Application ID (Client ID): Located in "General Information" at the top
- Server ID: Right-click on server in Discord > "Copy Server ID" (requires Developer Mode)

### 2. Configuring n8n

#### A. Importing the workflow
The repository ships a ready workflow. In n8n use **Workflows → Import from File** with [`assistant-workflow.n8n.json`](assistant-workflow.n8n.json), set its credentials, activate it and copy the webhook's **Production URL**. [N8N_INTEGRATION.md](N8N_INTEGRATION.md) walks through each step. To build your own instead, add a "Webhook" trigger (POST) and end with a "Respond to Webhook" node.

#### B. Message Handling
n8n will receive:
```json
{
  "userId": "123456789",
  "userName": "username",
  "message": "hello",
  "serverId": "987654321",
  "mode": "chat",
  "timestamp": "2024-02-02T10:30:00.000Z",
  "platform": "discord",
  "conversationContext": []
}
```

`mode` is `chat` for a plain DM and `code` for the `/code` command. `conversationContext` holds the user's recent exchanges with the bot.

#### C. Returning Response
Your workflow should return a response in the format:
```json
{
  "response": "Your response to the user"
}
```

### 3. Configuring Environment Variables

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in the variables:

```env
# Discord Data - REQUIRED
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_SERVER_ID=your_server_id_here

# n8n - REQUIRED
N8N_WORKFLOW_URL=https://your-n8n-instance.com/webhook/discord

# n8n - OPTIONAL in the bot, needed by the bundled workflows
# Random secret (openssl rand -hex 32), same value as the webhooks' Header Auth
N8N_API_KEY=replace_with_a_random_secret

# Database - REQUIRED (the other DB_* values have defaults)
DB_PASSWORD=your_secure_password_here

# AI moderation (issue #16) - OPTIONAL
# Off by default. To enable, see docs/AI_MODERATION.md for the full step-by-step
# n8n workflow setup. Once enabled, MOD_LOG_CHANNEL_ID becomes mandatory — in
# shadow mode it's the only place verdicts surface.
AI_MODERATION_MODE=off
N8N_MODERATION_WORKFLOW_URL=
MOD_LOG_CHANNEL_ID=
AI_MOD_INCLUDE_CHANNELS=
AI_MOD_EXEMPT_ROLES=
AI_MOD_MUTE_THRESHOLD=3
AI_MOD_BAN_THRESHOLD=100
AI_MOD_MAX_CONCURRENT=2
MOD_RULES_TEXT=

# Bot Configuration - OPTIONAL
# Language of the bot and dashboard (en, pl). See docs/I18N.md.
BOT_LANGUAGE=en
# Override the translated mention / no-permission replies. Empty = translated default.
HARDCODED_MENTION_RESPONSE=
RESTRICTED_RESPONSE=

# Role with access to AI Assistant - OPTIONAL
# If empty - everyone can use it
# If provided - only those with these roles
ALLOWED_ROLES_FOR_AI=role_id_1,role_id_2,role_id_3

# Logging
NODE_ENV=production
LOG_LEVEL=info
```

### 4. Getting Role ID

To get the role ID:
1. In Discord go to Server Settings > Roles
2. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
3. Right-click on the role and select "Copy Role ID"
If `ALLOWED_ROLES_FOR_AI` is empty, everyone can send messages to the AI Assistant.

### 5. Installation and Running

With Docker Compose, which also starts PostgreSQL and applies the migrations (see [DOCKER_SETUP.md](DOCKER_SETUP.md)):

```bash
docker compose up -d
```

Without Docker, with PostgreSQL already running:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Create the database tables
npm run migrate:up

# Run the bot
npm start

# Or for development with auto-reload
npm run dev
```

### 6. Verification

The bot should be online on Discord. Check:

1. **Mentioning in chat** (public channel):
   ```
   @BotName
   ```
   Bot should reply that you can DM it (or with `HARDCODED_MENTION_RESPONSE`, if set)

2. **Private message** (if you're in an authorized role):
   ```
   hello
   ```
   Bot should send to n8n and return a response

3. **Slash command** in the same DM: `/help` lists the commands you can use

4. **Checking logs** - `docker compose logs discord-bot`, or `logs/combined.log` without Docker

## 🔐 Security

- 🔒 Never commit `.env` to Git
- 🔑 Keep `DISCORD_TOKEN` secret
- 👥 Configure `ALLOWED_ROLES_FOR_AI` to restrict access
- 📝 Regularly check error logs

## 🐛 Troubleshooting

### Bot won't connect
- ✅ Check if `DISCORD_TOKEN` is correct
- ✅ Check if bot has permissions on the server
- ✅ Check logs: `docker compose logs -f discord-bot`, or `tail -f logs/combined.log` without Docker

### Commands don't work
- ✅ Run them in a DM with the bot; in a server channel the bot only points you to DMs
- ✅ Make sure the bot was invited with the `applications.commands` scope
- ✅ Wait a few minutes - Discord needs to synchronize them

### DM doesn't send to n8n
- ✅ Check `N8N_WORKFLOW_URL`
- ✅ Check if user has the allowed role (if `ALLOWED_ROLES_FOR_AI` is set)
- ✅ Check in n8n's Executions view whether the workflow ran
- ✅ Check that the Message Content intent is enabled

### User without access
- ✅ Check if they have the role from `ALLOWED_ROLES_FOR_AI`
- ✅ If `ALLOWED_ROLES_FOR_AI` is empty - everyone has access

## 📚 Additional Resources

- [Discord.js Documentation](https://discord.js.org/)
- [n8n Documentation](https://docs.n8n.io/)
- [Discord API Documentation](https://discord.com/developers/docs)
