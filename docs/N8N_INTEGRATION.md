# n8n Integration Guide

## Overview

The bot sends every DM (and every `/code` request) to an n8n workflow via a webhook. The workflow returns a reply, which the bot sends back to the user. The assistant only works in DMs.

AI moderation uses a second, separate workflow; see [AI_MODERATION.md](AI_MODERATION.md).

## Payload sent to n8n

```json
{
  "userId": "123456789012345678",
  "userName": "discord_username",
  "message": "message from user",
  "serverId": "987654321098765432",
  "mode": "chat",
  "timestamp": "2026-09-21T10:30:00.000Z",
  "platform": "discord",
  "conversationContext": [
    { "userMessage": "...", "aiResponse": "...", "timestamp": "2026-09-21T10:29:00.000Z" }
  ]
}
```

| Field | Description |
|---|---|
| `userId` | Discord user ID; the bundled workflow uses it as the memory session key |
| `userName` | Discord username |
| `message` | The user's message |
| `serverId` | `DISCORD_SERVER_ID` |
| `mode` | `"chat"` for a plain DM, `"code"` for the `/code` command |
| `timestamp` | ISO timestamp |
| `platform` | Always `"discord"` |
| `conversationContext` | The bot's own recent history for this user, when it has any. The bundled workflow ignores it and uses n8n's Postgres memory instead |

When `N8N_API_KEY` is set, every request carries it as an `X-API-Key` header. Use a random secret for it (`openssl rand -hex 32`), not an n8n API key: the value is sent with every webhook call and stored in the webhook's credential.

## Expected response

```json
{
  "response": "Reply for the user"
}
```

The bot splits long replies to fit Discord's message limit.

## The bundled workflow

[`assistant-workflow.n8n.json`](assistant-workflow.n8n.json) is a ready-to-import version of the workflow the bot is developed against:

```
Discord Webhook → Extract payload → Check Mode ─┬─ code → Code agent ────┬→ ResponseMerger → Send Response to Discord
                                                └─ chat → General agent ─┘
```

- **Code** agent: coding system prompt, `qwen2.5-coder:7b-instruct` on Ollama.
- **General** agent: `ministral-3:8b` on Ollama, with two tools: `web_search` (SearXNG) and `wikipedia`.
- **Postgres Chat Memory**, shared by both agents: session key `userId`, window of 20 messages.

Swap the models freely. The General agent's model must support tool calling. For another provider, replace the Ollama node with that provider's chat-model node and connect it to the agent's **Chat Model** input.

### Import and configure

1. In n8n: **Workflows → Import from File** → `docs/assistant-workflow.n8n.json`.
2. **Discord Webhook**: select a **Header Auth** credential with header name `X-API-Key` and your `N8N_API_KEY` as the value. The import ships a placeholder credential ID, so create or pick your own.
3. **Qwen2.5 Coder 7B** and **Ministral3 8B**: select your **Ollama** credential.
4. **Postgres Chat Memory**: select a **Postgres** credential for the **bot's database** (the same `DB_*` values as in `.env`). n8n creates its `n8n_chat_histories` table there, and the bot's `/flushmemory` and `/flushdb` clear it. With a different database, those commands only clear the bot's side.
5. **web_search**: replace `https://searxng.example.com/search` with your SearXNG instance (see below), or delete the node to run without web search.
6. **Activate** the workflow and copy the webhook's **Production URL** into `.env` as `N8N_WORKFLOW_URL`.

### SearXNG for web search

The `web_search` tool calls `GET <url>?q=<query>&format=json`. The model writes the query itself (`$fromAI('query')`), and the response is trimmed to each result's `title`, `url` and `content` before the model sees it.

Your SearXNG instance must:

- **Serve JSON**: add `json` to `search.formats` in `settings.yml`. It is off by default, and without it every request fails.
- **Not rate-limit n8n**: with `server.limiter` or `server.public_instance` enabled, the limiter blocks non-browser clients (HTTP 429). Add the address n8n reaches SearXNG from to `botdetection.ip_lists.pass_ip` in `limiter.toml`. If n8n goes through a published Docker port, SearXNG sees the Docker network gateway rather than n8n's own IP, so that gateway is the address to allow. Alternatively, run a private instance with the limiter off.

Keep the JSON endpoint reachable only from n8n, e.g. over a private network or VPN, rather than exposing an unthrottled search API publicly.

## Testing the workflow

```bash
# Chat mode
curl -X POST https://your-n8n.example.com/webhook/exemplar \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $N8N_API_KEY" \
  -d '{"userId":"test-user","userName":"tester","message":"hello","serverId":"0","mode":"chat","timestamp":"2026-09-21T10:00:00Z","platform":"discord"}'

# Code mode
curl -X POST https://your-n8n.example.com/webhook/exemplar \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $N8N_API_KEY" \
  -d '{"userId":"test-user","userName":"tester","message":"write a function to sort an array","serverId":"0","mode":"code","timestamp":"2026-09-21T10:00:00Z","platform":"discord"}'
```

Test calls are stored in the chat memory under their `userId`. Use a throwaway ID, and remove it afterwards with `DELETE FROM n8n_chat_histories WHERE session_id = 'test-user';`.

## Troubleshooting

The bot classifies n8n failures and shows the user a matching message (the `assistant.errors` texts in `src/locales/<language>.json`):

| Error the user sees | Likely cause |
|---|---|
| Backend unavailable | n8n is down or `N8N_WORKFLOW_URL` points at the wrong host |
| Workflow not found (404) | The workflow isn't active, or the URL is the test URL instead of the production one |
| Authentication failed (401/403) | `N8N_API_KEY` doesn't match the webhook's Header Auth credential |
| Timeout | The workflow took longer than the client timeout (120 s, `src/utils/n8n-client.ts`); common with a cold local model |
| Missing `response` field | The workflow responded without a `response` key |
| Assistant never uses web search, or says it failed | SearXNG returns 429 or 403 to n8n; see [SearXNG for web search](#searxng-for-web-search) |

Check each execution in n8n's **Executions** view. On the bot side, logs are in `logs/combined.log` and `logs/error.log`.

## Building your own workflow

Any workflow works as long as it accepts the payload above on a POST webhook and responds with `{ "response": "..." }`. Use **Respond to Webhook** (response mode "Using 'Respond to Webhook' node") so the reply goes back in the same HTTP request, and route on `mode` if you want a separate coding model.

To pass extra data from the bot, extend `N8NWebhookPayload` in `src/types/n8n.ts` and `sendMessage()` in `src/utils/n8n-client.ts`.

## Resources

- [n8n documentation](https://docs.n8n.io/)
- [SearXNG limiter](https://docs.searxng.org/admin/searx.limiter.html)
