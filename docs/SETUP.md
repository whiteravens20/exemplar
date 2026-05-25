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
2. Click "Add Bot"
3. Under "TOKEN" click "Copy" and save the token somewhere safe (this is your `DISCORD_TOKEN`)

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
   - Moderation:
     - Kick Members
     - Ban Members
     - Timeout Members

4. Copy the generated URL and open it in your browser to add the bot to your server

#### D. Retrieving Application ID and Server ID
- Application ID (Client ID): Located in "General Information" at the top
- Server ID: Right-click on server in Discord > "Copy Server ID" (requires Developer Mode)

### 2. Configuring n8n

#### A. Creating Webhook Trigger
1. In n8n create a new workflow
2. Add "Webhook" trigger
3. Configure:
   - **HTTP Method**: POST
   - **Path**: `/discord` (or another path)
4. In "Webhook URL Details" copy the full URL

#### B. Message Handling
n8n will receive:
```json
{
  "userId": "123456789",
  "userName": "username",
  "message": "hello",
  "serverId": "987654321",
  "timestamp": "2024-02-02T10:30:00.000Z",
  "platform": "discord"
}
```

#### C. Returning Response
Your workflow should return a response in the format:
```json
{
  "response": "Your response to the user"
}
```

Or simply - if the last node returns a `response` field, the bot will execute it.

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

# n8n - OPTIONAL
N8N_API_KEY=your_api_key_here

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

# Bot Configuration - OPTIONAL
HARDCODED_MENTION_RESPONSE=Hi! I'm an AI Assistant. Send me a DM to chat with me.
RESTRICTED_RESPONSE=You don't have permission to use this feature. Please contact the admins.

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

```bash
# Install dependencies
npm install

# Test configuration (optional)
npm run typecheck

# Build the project
npm run build

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
   Bot should respond with `HARDCODED_MENTION_RESPONSE`

2. **Private message** (if you're in an authorized role):
   ```
   /help
   ```
   Bot should send to n8n and return a response

3. **Checking logs** - check `combined.log` to see details

## 🔐 Security

- 🔒 Never commit `.env` to Git
- 🔑 Keep `DISCORD_TOKEN` secret
- 👥 Configure `ALLOWED_ROLES_FOR_AI` to restrict access
- 📝 Regularly check error logs

## 🐛 Troubleshooting

### Bot won't connect
- ✅ Check if `DISCORD_TOKEN` is correct
- ✅ Check if bot has permissions on the server
- ✅ Check logs: `tail -f combined.log`

### Commands don't work
- ✅ Make sure bot has permissions for `/` commands
- ✅ Wait a few minutes - Discord needs to synchronize them
- ✅ Check if Intents are enabled

### DM doesn't send to n8n
- ✅ Check `N8N_WORKFLOW_URL`
- ✅ Check if user has the allowed role (if `ALLOWED_ROLES_FOR_AI` is set)
- ✅ Sprawdź n8n logi czy workflow się wykonuje

### User without access
- ✅ Check if they have the role from `ALLOWED_ROLES_FOR_AI`
- ✅ If `ALLOWED_ROLES_FOR_AI` is empty - everyone has access

## 📚 Additional Resources

- [Discord.js Documentation](https://discord.js.org/)
- [n8n Documentation](https://docs.n8n.io/)
- [Discord API Documentation](https://discord.com/developers/docs)
