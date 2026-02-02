# Discord AI Assistant Bot - Project Structure

```
discord-ai-bot/
│
├── 📄 README.md                  # Main documentation
├── 📄 SETUP.md                   # Configuration instructions
├── 📄 N8N_INTEGRATION.md         # n8n documentation
├── 📄 package.json               # Dependencies and scripts
├── 📄 .env.example               # Variable template
├── 📄 .gitignore                 # Git ignore rules
├── 📄 LICENSE                    # MIT License
│
├── 🚀 src/
│   │
│   ├── 📄 index.js               # Main entry point
│   ├── 📄 deploy-commands.js     # Slash commands deployment
│   │
│   ├── 📁 slashcommands/         # Slash commands
│   │   ├── kick.js               # /kick command
│   │   ├── ban.js                # /ban command
│   │   ├── mute.js               # /mute command
│   │   ├── warn.js               # /warn command
│   │   └── help.js               # /help command
│   │
│   ├── 📁 events/                # Event handlers
│   │   ├── ready.js              # Bot startup
│   │   ├── messageCreate.js      # Message & DM handling
│   │   ├── interactionCreate.js  # Slash command handling
│   │   └── error.js              # Error handling
│   │
│   ├── 📁 utils/                 # Utilities
│   │   ├── logger.js             # Winston logger
│   │   ├── n8n-client.js         # n8n integration
│   │   ├── openai-client.js      # OpenAI integration (optional)
│   │   ├── permissions.js        # Role checking
│   │   └── error-handler.js      # Error utilities
│   │
│   └── 📁 config/                # Configuration
│       ├── config.js             # Config manager
│       ├── bot-statuses.js       # Bot activity statuses
│       └── response-templates.js # Response templates
│
├── 📁 commands/                  # Legacy command system (unused)
│   ├── moderation/
│   │   ├── kick.js
│   │   ├── ban.js
│   │   ├── mute.js
│   │   └── warn.js
│
├── 📄 test-config.js             # Configuration validator
├── 📄 n8n-workflow-example.json  # Example n8n workflow
└── 📄 start.sh                   # Quick start script

```

## 📊 Feature Map

### 🤖 AI Assistant (Main Feature)
- **File:** `src/events/messageCreate.js`
- **Integration:** `src/utils/n8n-client.js`
- **Config:** `src/config/config.js`
- **Response:** Customizable via `.env` HARDCODED_MENTION_RESPONSE

### 🛡️ Moderation Commands
- **Location:** `src/slashcommands/`
- **Handlers:** `src/events/interactionCreate.js`
- **Authorization:** `src/utils/permissions.js`
- Commands: kick, ban, mute, warn, help

### 🔐 Permission System
- **File:** `src/utils/permissions.js`
- **Role-based:** ALLOWED_ROLES_FOR_AI in .env
- **Admin-only:** Moderation commands require ModerateMembers permission

### 📝 Logging System
- **File:** `src/utils/logger.js`
- **Output:** console, combined.log, error.log
- **Level:** Configurable via LOG_LEVEL in .env

## 🔄 Data Flow

```
[Discord User]
      ↓
[Message/Command]
      ↓
[Bot Event Handler]
      ├─→ Mention? → Send hardcoded response
      ├─→ DM? → Check permissions → Send to n8n → Get response
      └─→ Slash Command? → Check permissions → Execute command
      ↓
[Response to User]
```

## 🔧 Configuration Priority

1. `.env` file (production)
2. Environment variables
3. `.env.example` (fallback/defaults)

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| discord.js | 14.14.0 | Discord API |
| dotenv | 16.3.1 | .env loading |
| axios | 1.6.2 | HTTP requests (n8n) |
| winston | 3.11.0 | Logging |
| nodemon | 3.0.2 | Dev auto-reload |

## 🚀 Scripts

```bash
npm start           # Production run
npm run dev         # Development with auto-reload
npm run test-config # Validate configuration
npm run deploy-commands # Deploy slash commands
```

## 📋 Environment Variables

### Required
- `DISCORD_TOKEN` - Bot token
- `DISCORD_CLIENT_ID` - App ID
- `DISCORD_SERVER_ID` - Server ID
- `N8N_WORKFLOW_URL` - Webhook URL

### Optional
- `N8N_API_KEY` - n8n authentication
- `HARDCODED_MENTION_RESPONSE` - Mention response
- `RESTRICTED_RESPONSE` - Access denied message
- `ALLOWED_ROLES_FOR_AI` - Authorized roles
- `BOT_PREFIX` - Command prefix
- `LOG_LEVEL` - Logging level
- `NODE_ENV` - production/development

## 🎯 Extension Points

### Adding a Command
1. Create file in `src/slashcommands/`
2. Add to slash command builder
3. Define execute function
4. Auto-loaded in `src/index.js`

### Adding an Event
1. Create file in `src/events/`
2. Export with name and execute
3. Auto-loaded in `src/index.js`

### Custom Responses
1. Edit `src/config/response-templates.js`
2. Update `.env` for basic responses
3. Create helper functions in `src/utils/`

### n8n Integration
1. See `N8N_INTEGRATION.md`
2. Configure `N8N_WORKFLOW_URL` in .env
3. Test with `curl` or n8n UI

## 🐛 Debugging

```bash
# Watch logs in real-time
tail -f combined.log

# Watch errors only
tail -f error.log

# Test configuration
node test-config.js

# Check n8n connection (from bot logs)
grep "n8n" combined.log
```

## 📈 Performance Considerations

- **Message Rate**: Limited by Discord API (5 msgs/5s per user)
- **n8n Timeout**: 30 seconds (configurable)
- **Status Rotation**: Every 30 seconds
- **DM Processing**: Async with typing indicator

## 🔒 Security Checklist

- ✅ .env in .gitignore
- ✅ DISCORD_TOKEN never logged
- ✅ Role-based access control
- ✅ Moderator-only commands
- ✅ Error messages don't expose internals
- ✅ Input validation before n8n

## 📞 Support

For issues:
1. Check `combined.log` for errors
2. Run `npm run test-config`
3. Verify .env configuration
4. Check n8n workflow logs
5. Review Discord permissions

---

**Created:** 2024-02-02
**License:** MIT
