# Discord AI Assistant Bot

A Discord bot with n8n workflow integration for AI Assistant and moderation options.

## 📋 Features

### 🤖 AI Assistant
- Bot responds to mentions with hardcoded message in chat
- PM (Direct Messages) triggers n8n workflow
- AI Assistant available only for specific roles
- Other users receive hardcoded response

### 🛡️ Moderation Commands (Slash Commands)
- `/kick` - Kick user from server
- `/ban` - Ban user from server
- `/mute` - Timeout user (configurable duration)
- `/warn` - Send warning to user

## 🚀 Installation

### 1. Requirements
- Node.js 20+
- npm 10+ or yarn

### 2. Clone and Install
```bash
git clone <repository>
cd discord-ai-bot
npm install
```

### 3. Configure `.env`
Copy `.env.example` to `.env` and fill in the variables:

```bash
cp .env.example .env
```

```env
# Discord
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id
DISCORD_SERVER_ID=your_server_id

# n8n
N8N_WORKFLOW_URL=https://your-n8n.com/webhook/workflow
N8N_API_KEY=your_api_key

# Bot Configuration
BOT_PREFIX=!
HARDCODED_MENTION_RESPONSE=Hi! I'm an AI Assistant. Send me a DM to chat with me.

# Moderation
ALLOWED_ROLES_FOR_AI=role_id_1,role_id_2,role_id_3
RESTRICTED_RESPONSE=You don't have permission to use this feature.

# Environment
NODE_ENV=production
```

### 4. Running

**Production:**
```bash
npm start
```

**Development (with auto-reload):**
```bash
npm run dev
```

### 5. Running in Docker

For detailed Docker setup instructions, see [DOCKER_SETUP.md](DOCKER_SETUP.md).

**Quick Start with Docker Compose:**
```bash
# Copy and configure environment file
cp .env.example .env

# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

**Manual Docker Commands:**
```bash
# Build image
docker build -t discord-ai-bot:latest .

# Run container
docker run -d \
  --name discord-ai-bot \
  --restart unless-stopped \
  --env-file .env \
  discord-ai-bot:latest

# View logs
docker logs -f discord-ai-bot

# Stop container
docker stop discord-ai-bot
```

## 📖 Detailed Features

### Mentioning Bot in Chat
When someone mentions the bot in chat (e.g., `@BotName`), the bot automatically replies in the channel with a hardcoded message.

```
User: @AIBot help
Bot: Hi! I'm an AI Assistant. Send me a DM to chat with me.
```

### Direct Messages (PM)

#### For Authorized Users (with allowed roles):
1. User sends PM to bot
2. Bot checks if user has allowed role in server
3. If YES - message is sent to n8n workflow
4. Bot waits for response from n8n and sends it to user

#### For Unauthorized Users:
- They receive hardcoded response about access denial

### Moderation Commands

All moderators and admins can use slash commands:

```
/kick @user [reason]
/ban @user [reason]
/mute @user [duration] [reason]
/warn @user [reason]
```

## 🔐 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_TOKEN` | Discord bot token | `your_bot_token` |
| `DISCORD_CLIENT_ID` | Discord app ID | `123456789` |
| `DISCORD_SERVER_ID` | Server ID for AI Assistant | `987654321` |
| `N8N_WORKFLOW_URL` | n8n webhook URL | `https://n8n.io/webhook/abc123` |
| `N8N_API_KEY` | n8n API key (optional) | `key_xyz` |
| `HARDCODED_MENTION_RESPONSE` | Message on mentions | `Hi! I'm an AI Assistant...` |
| `ALLOWED_ROLES_FOR_AI` | Roles with AI access (comma-separated) | `role_id_1,role_id_2` |
| `RESTRICTED_RESPONSE` | Response for denied access | `You don't have permission...` |

## 📁 Project Structure

```
discord-ai-bot/
├── src/
│   ├── index.js                 # Main bot file
│   ├── slashcommands/           # Slash commands
│   │   ├── kick.js
│   │   ├── ban.js
│   │   ├── mute.js
│   │   └── warn.js
│   ├── events/                  # Event handlers
│   │   ├── ready.js
│   │   ├── messageCreate.js     # Message handling
│   │   └── interactionCreate.js # Command handling
│   └── utils/
│       ├── logger.js            # Logger
│       ├── n8n-client.js        # n8n integration
│       └── permissions.js       # Permission helpers
├── .env.example                 # Variables template
├── .gitignore
├── package.json
└── README.md
```

## 🔧 Customization

### Change Hardcoded Message
Edit `.env`:
```env
HARDCODED_MENTION_RESPONSE=Your custom message
```

### Add Authorized Roles
Edit `.env`:
```env
ALLOWED_ROLES_FOR_AI=role_id_1,role_id_2,role_id_3
```

### n8n Integration
1. Create workflow in n8n
2. Add Webhook trigger
3. Copy URL to `.env`
4. n8n receives: `userId`, `userName`, `message`, `serverId`, `timestamp`

## 📝 Logs

Logs are saved in:
- `error.log` - errors only
- `combined.log` - all logs
- Console - screen output

## 🤝 Contributing

Pull requests welcome!

## 📄 License

MIT
