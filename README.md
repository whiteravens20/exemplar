# Exemplar

A self-hosted Discord bot that pairs an n8n-powered AI assistant in DMs with slash-command and AI-driven moderation for a single server.

[![Tests](https://github.com/whiteravens20/exemplar/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/whiteravens20/exemplar/actions/workflows/test.yml)
[![CodeQL](https://github.com/whiteravens20/exemplar/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/whiteravens20/exemplar/actions/workflows/codeql.yml)
[![Release](https://github.com/whiteravens20/exemplar/actions/workflows/release.yml/badge.svg)](https://github.com/whiteravens20/exemplar/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)

## Features

### AI assistant (DMs)
- Plain DMs go to an n8n workflow in `chat` mode; `/code <message>` goes in `code` mode, routed to a coding model.
- Access is limited to members holding one of `ALLOWED_ROLES_FOR_AI`; everyone else gets `RESTRICTED_RESPONSE`.
- Mentioning the bot in a channel returns `HARDCODED_MENTION_RESPONSE` and points the user to DMs.
- The bundled workflow gives the chat model **web search** (SearXNG) and **Wikipedia** tools, and per-user memory in Postgres.
- Conversation memory: the last 20 messages per user, kept for 24 hours; `/flushmemory` clears it on both the bot and the n8n side.

### Moderation
- Slash commands `/kick`, `/ban`, `/unban`, `/mute`, `/unmute`, `/warn`, run from a DM and acting on `DISCORD_SERVER_ID`.
- Each command checks the invoker's server permissions and role hierarchy; the target is DMed the reason and duration before the action.
- Optional **AI moderation**: eligible channel messages go to a second n8n workflow that returns `allow`, `warn`, `timeout` or `delete`, executed through the same action layer as the slash commands. Roll it out in `shadow` mode first. See [docs/AI_MODERATION.md](docs/AI_MODERATION.md).
- Escalation across all warnings, human or AI: 3 active warnings auto-mute, 100 lifetime warnings auto-ban (both configurable).

### Storage and operations
- PostgreSQL for conversation history, rate limits, warnings (30-day expiry), usage analytics (90 days) and the moderation log.
- The Docker image runs pending migrations on start; the bot falls back to in-memory state if the database is unavailable.
- `/health` endpoint on `HEALTH_CHECK_PORT` for orchestration.
- Optional read-only **logging dashboard** behind Discord OAuth2. See [docs/DASHBOARD.md](docs/DASHBOARD.md).
- n8n errors are classified (offline, timeout, 404, auth) and retried with exponential backoff.

## Commands

All commands are slash commands and run in **DMs with the bot**. Used in a server channel they return the mention response instead.

| Command | Who | What it does |
|---|---|---|
| `/help` | AI roles, admins | List the commands you can use |
| `/rules` | everyone | Show the server rules |
| `/code <message>` | AI roles | Ask the coding model |
| `/flushmemory` | AI roles | Clear your conversation history (bot and n8n memory) |
| `/warnings` | AI roles, admins | Your active warnings |
| `/kick <user> [reason]` | Kick Members | Kick a member |
| `/ban <user> [reason]` | Ban Members | Ban a member |
| `/unban <user_id>` | Ban Members | Remove a ban |
| `/mute <user> <duration> [reason]` | Timeout Members | Timeout a member, e.g. `10m`, `1h`, `1d` |
| `/unmute <user>` | Timeout Members | Remove a timeout |
| `/warn <user> <reason>` | Timeout Members | Issue a warning |
| `/warnings [user]` | admins | All warnings, or one user's |
| `/stats [days]` | admins | Usage statistics (default 7 days) |
| `/flushdb confirm:true` | admins | Clear conversation data (bot and n8n), keeping users and warnings |

## Install

### Deployment model

Exemplar is **self-hosted and single-server**. There is no public instance: you create your own Discord application, run one bot for one server, and bring your own n8n. The app is guild-installed (OAuth2 scopes `bot` and `applications.commands`), and `DISCORD_SERVER_ID` is the server every moderation command acts on.

### Requirements

- Node.js 22+ and npm 11+, or Docker with Compose
- PostgreSQL 14+ (included in `docker-compose.yml`)
- An n8n instance with a chat model (the bundled workflows use Ollama)
- Optional: a SearXNG instance for the assistant's web search

### 1. Clone and configure

```bash
git clone https://github.com/whiteravens20/exemplar.git
cd exemplar
cp .env.example .env
```

Fill in `.env`. The minimum is:

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_SERVER_ID` | The one server the bot serves |
| `N8N_WORKFLOW_URL` | Production URL of the assistant workflow's webhook |
| `N8N_API_KEY` | Sent as `X-API-Key`; must match the webhook's Header Auth credential |
| `ALLOWED_ROLES_FOR_AI` | Comma-separated role IDs allowed to use the assistant |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |

Every other option (AI moderation, dashboard, response texts, mod-log channel, limits) is documented inline in [`.env.example`](.env.example). Full walkthrough: [docs/SETUP.md](docs/SETUP.md).

### 2. Set up n8n

Two ready-made workflows ship in `docs/`. In n8n, use **Workflows → Import from File** for each:

| File | Bot variable | Purpose |
|---|---|---|
| [`docs/assistant-workflow.n8n.json`](docs/assistant-workflow.n8n.json) | `N8N_WORKFLOW_URL` | DM assistant: routes `chat` / `code`, web search, Wikipedia, Postgres memory |
| [`docs/moderation-workflow.n8n.json`](docs/moderation-workflow.n8n.json) | `N8N_MODERATION_WORKFLOW_URL` | AI moderation verdicts (optional) |

After importing, fill in what every fork has to supply itself; each node's note says what it expects:

1. **Header Auth** credential on each webhook: header `X-API-Key`, value = your `N8N_API_KEY`.
2. **Ollama** credential on the model nodes, or swap them for another provider's chat-model node.
3. **Postgres** credential on *Postgres Chat Memory*, pointing at the **bot's own database**, so `/flushmemory` and `/flushdb` can clear the n8n memory.
4. The **SearXNG URL** in *web_search*. The instance must allow `format=json` and must not rate-limit n8n: list n8n's IP in `pass_ip` in `limiter.toml`, or run the instance with the limiter off. Without SearXNG, delete the node and the assistant keeps Wikipedia.
5. **Activate** the workflow and copy the webhook's production URL into `.env`.

Payloads, responses and testing: [docs/N8N_INTEGRATION.md](docs/N8N_INTEGRATION.md).

## Run

Slash commands are registered with Discord automatically on startup.

### Docker Compose (recommended)

```bash
docker compose up -d
docker compose logs -f discord-bot
curl http://localhost:3000/health
```

Compose starts PostgreSQL, waits for it to be healthy, runs pending migrations and starts the bot. Release images are published to `ghcr.io/whiteravens20/exemplar` (tags `X.Y.Z`, `X.Y`, `X` and `main`). See [docs/DOCKER_SETUP.md](docs/DOCKER_SETUP.md).

### Node.js

```bash
npm install
npm run build
npm run migrate:up
npm start
```

For development, `npm run dev` rebuilds and restarts on changes. `npm test`, `npm run typecheck` and `npm run lint` run the checks CI runs.

Logs go to the console and to `logs/combined.log` and `logs/error.log`.

## Documentation

| Document | Contents |
|---|---|
| [SETUP.md](docs/SETUP.md) | Discord application, n8n and environment setup |
| [QUICKSTART.md](docs/QUICKSTART.md) | Shortest path to a running bot |
| [N8N_INTEGRATION.md](docs/N8N_INTEGRATION.md) | Webhook payloads, responses, the assistant workflow |
| [AI_MODERATION.md](docs/AI_MODERATION.md) | AI moderation setup and tuning |
| [DATABASE.md](docs/DATABASE.md) | Schema, retention, migrations |
| [DASHBOARD.md](docs/DASHBOARD.md) | Logging dashboard |
| [DOCKER_SETUP.md](docs/DOCKER_SETUP.md) | Docker deployment |
| [DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) | Production checklist |
| [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) | Code layout |
| [CICD.md](.github/CICD.md) | CI workflows and branch protection |
| [FAQ.md](docs/FAQ.md) | Frequently asked questions |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md), then open a pull request against `dev`.

## Security

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in public issues.

## License

[MIT](LICENSE)
