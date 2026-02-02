# n8n Integration Guide

## Overview

Discord Bot sends messages to an n8n workflow via Webhook. n8n processes the message and returns a response, which the bot sends back to the user.

## Payload Sent to n8n

```json
{
  "userId": "discord_user_id",
  "userName": "discord_username",
  "message": "message from user",
  "serverId": "discord_server_id",
  "timestamp": "2024-02-02T10:30:00.000Z",
  "platform": "discord"
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

### 1. Simple Echo Bot

```javascript
// Function Node
const message = $input.first().json.message;
const userName = $input.first().json.userName;

return {
  response: `You said: "${message}", ${userName}!`
};
```

### 2. OpenAI Integration

```
Webhook -> HTTP Request (OpenAI API) -> Format Response -> Return Response
```

### 3. Database Integration

```
Webhook -> Save to DB -> Query DB for context -> Call LLM -> Return Response
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
# Send test payload with curl
curl -X POST https://your-n8n.com/webhook/discord \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123",
    "userName": "testuser",
    "message": "hello",
    "serverId": "456",
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
- Zmień timeout w `src/utils/n8n-client.js` (parametr `timeout`)

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

### Persistent Conversation History

You can keep conversation history in n8n Database:

```javascript
// In workflow
const userId = $input.first().json.userId;

// Query history
const history = $input.item.binaryData.data; // or from DB

// Add to conversation
messages.push({ role: 'user', content: message });

// Save updated history
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

1. **In bot** - edit `src/events/messageCreate.js`:
```javascript
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
