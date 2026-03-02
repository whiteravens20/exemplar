# n8n Integration Guide

## Overview

Discord Bot sends messages to an n8n workflow via Webhook. n8n processes the message and returns a response, which the bot sends back to the user.

**Important:** Bot works **only in DMs** (Direct Messages). All channel commands are ignored.

## Payload Sent to n8n

```json
{
  "userId": "discord_user_id",
  "userName": "discord_username",
  "message": "message from user",
  "serverId": "discord_server_id",
  "mode": "chat",
  "timestamp": "2024-02-02T10:30:00.000Z",
  "platform": "discord"
}
```

### Field Descriptions

- `userId` - Discord user ID
- `userName` - Discord username
- `message` - User's message content (with `!code` prefix removed if applicable)
- `serverId` - Discord server ID (from bot configuration)
- `mode` - **"chat"** (default) or **"code"** (when user uses `!code` command)
- `timestamp` - ISO timestamp
- `platform` - Always "discord"

### Mode Field

The `mode` field allows you to route messages to different LLMs:

- **`"chat"`** - General conversation, use GPT-3.5/GPT-4 or similar
- **`"code"`** - Programming/coding help, use code-optimized LLM or system prompt

**User activates code mode by:**
```
!code write a function to sort an array
```

Bot will send:
```json
{
  "message": "write a function to sort an array",
  "mode": "code"
}
```

## Expected Response from n8n

```json
{
  "response": "Response for user"
}
```

## Creating Workflow in n8n

### Method 1: Webhook Trigger (Recommended)

1. **Create a new workflow**
2. **Add Webhook Trigger**
   - HTTP Method: POST
   - Path: `/discord` (or another)
3. **Add processing logic**
   - E.g. function node to handle messages
   - Integration with API (OpenAI, others)
4. **Add Response Node**
   - Return `{ response: "Your response" }`

### Method 2: HTTP Request (for existing APIs)

If you already have an API:
```
POST https://your-api.com/chat
Body: { message, userId, userName }
Response: { response }
```

Just set `N8N_WORKFLOW_URL` to the n8n endpoint that forwards requests.

## Workflow Examples

### 1. Mode-Based Routing (Recommended)

Use an IF node to route based on `mode`:

```javascript
// IF Node condition:
// $json.mode === "code"

// TRUE branch (Coding LLM):
const message = $json.message;
const userName = $json.userName;

// Use OpenAI with coding system prompt
// or specialized coding LLM
return {
  response: `Here's the code solution...`,
  mode: 'code'
};

// FALSE branch (Chat LLM):
const message = $json.message;
const userName = $json.userName;

// Use general conversational LLM
return {
  response: `Hi ${userName}, let me help you...`,
  mode: 'chat'
};
```

### 2. Simple Echo Bot

```javascript
// Function Node
const message = $input.first().json.message;
const userName = $input.first().json.userName;
const mode = $input.first().json.mode;

return {
  response: `[${mode}] You said: "${message}", ${userName}!`
};
```

### 3. OpenAI Integration

```
Webhook -> Check Mode (IF) -> 
  ├─ [code] -> OpenAI (with code system prompt) -> Return Response
  └─ [chat] -> OpenAI (with chat system prompt) -> Return Response
```

### 4. Database Integration

```
Webhook -> Save to DB -> Query DB for context -> Check Mode -> Call appropriate LLM -> Return Response
```

## Monitoring and Debugging

### Logs in n8n
- Check the n8n dashboard for each execution
- Click on each step to see input/output

### Logs in Bot
```bash
tail -f combined.log          # All logs
tail -f error.log             # Errors only
```

### Testing Workflow

```bash
# Test chat mode (default)
curl -X POST https://your-n8n.com/webhook/discord \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123",
    "userName": "testuser",
    "message": "hello",
    "serverId": "456",
    "mode": "chat",
    "timestamp": "2024-02-02T10:00:00Z",
    "platform": "discord"
  }'

# Test code mode
curl -X POST https://your-n8n.com/webhook/discord \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123",
    "userName": "testuser",
    "message": "write a function to sort array",
    "serverId": "456",
    "mode": "code",
    "timestamp": "2024-02-02T10:00:00Z",
    "platform": "discord"
  }'
```

## Troubleshooting

### Bot Says "Error processing your message"

**Causes:**
- n8n workflow is offline
- Webhook URL is wrong
- n8n returns an error
- Response missing `response` field

**Solution:**
```bash
# 1. Check URL
echo $N8N_WORKFLOW_URL

# 2. Test workflow in n8n UI

# 3. Check logs
tail -f error.log

# 4. Make sure response has "response" field
```

### Timeouts

If workflow takes >30 seconds, bot will display timeout.

**Solution:**
- Optimize n8n workflow
- Change timeout in `src/utils/n8n-client.ts` (parametr `timeout`)

### Rate Limiting

If you have many users, set rate limiting in n8n or middleware.

## API Keys and Security

If your workflow requires API keys:

```env
N8N_API_KEY=your_api_key_here
```

Bot will add it to the header:
```
X-API-Key: your_api_key_here
```

## Advanced

### Using PostgreSQL as AI Agent Memory

The bot sends `conversationContext` in the payload (last 20 messages), but you can configure the **AI Agent node** in n8n to use PostgreSQL as persistent memory storage.

#### Setup PostgreSQL Memory in n8n:

**1. Create PostgreSQL Credential in n8n:**
```
Settings → Credentials → Add Credential → Postgres account
- Host: postgres (if n8n is in docker-compose) or 192.168.2.16 (external)
- Port: 5432
- Database: exemplar (or your DB_NAME)
- User: dbot_user (or your DB_USER)
- Password: [your DB_PASSWORD]
```

**2. Configure AI Agent Node:**
```javascript
AI Agent Node Settings:
┌─────────────────────────────┐
│ Memory                      │
│ ✓ Use Memory               │
│                             │
│ Memory Type: PostgreSQL     │ ← Select this
│                             │
│ Connection:                 │
│   [Select PostgreSQL Cred]  │
│                             │
│ Session ID:                 │
│   {{ $json.userId }}        │ ← Important: Use Discord user ID
│                             │
│ Window Size: 20             │ ← Number of messages to remember
└─────────────────────────────┘
```

**3. Memory Schema (Auto-created by n8n):**
```sql
-- n8n will create this table automatically:
CREATE TABLE IF NOT EXISTS n8n_chat_histories (
  session_id VARCHAR(255) PRIMARY KEY,
  messages JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Benefits:

1. **Persistent Memory** - Conversations survive bot restarts
2. **Per-User Memory** - Each user has isolated conversation history
3. **Automatic Management** - n8n handles memory lifecycle
4. **Window Control** - Limits memory to last N messages (recommended: 20)

#### Example Workflow:

```
┌────────────────┐
│ Webhook Trigger│ ← Receives Discord message
└────────┬───────┘
         │
┌────────▼─────────────────────────┐
│ AI Agent Node                    │
│                                  │
│ Memory: PostgreSQL               │
│ Session ID: {{ $json.userId }}  │
│ Window: 20 messages              │
│                                  │
│ Model: ChatOpenAI                │
│ System Prompt: "You are..."     │
└────────┬─────────────────────────┘
         │
┌────────▼────────┐
│ Return Response │
└─────────────────┘
```

#### How It Works:

1. Discord bot sends message with `userId`
2. AI Agent looks up memory by `sessionId` (userId)
3. Loads last 20 messages from PostgreSQL
4. Processes new message with context
5. Saves updated conversation to PostgreSQL
6. Returns response

#### Optional: Use Bot's Conversation Context

The bot already sends conversation history in the payload. You can choose:

**Option A: Use AI Agent PostgreSQL Memory (Recommended)**
- Clean and automatic
- Managed by n8n
- Separate from bot's analytics

**Option B: Use Bot's `conversationContext` Payload**
- Already available in webhook payload
- Good for temporary context
- Shared with bot's analytics database

**Option C: Hybrid Approach**
```javascript
// Use both: bot context + AI Agent memory
// AI Agent will merge them automatically
```

### Multi-Language Support

```javascript
// Detect language
const language = $input.first().json.language || 'en';

// Route to appropriate workflow
// Or process message with language context
```

### Custom User Data

You can extend the payload:

1. **In bot** - edit `src/events/messageCreate.ts`:
```typescript
const result = await n8nClient.sendMessage({
  ...data,
  customField: 'value',
  userLevel: member.roles.highest.position
});
```

2. **In n8n** - you'll receive it in the payload

## Wsparcie

- [n8n Documentation](https://docs.n8n.io/)
- [n8n Community](https://community.n8n.io/)
- Discord Bot Issues: Sprawdź `combined.log`
