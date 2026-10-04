# Contributing to Exemplar

Thank you for considering a contribution to Exemplar. The bot **moderates a Discord server and passes its members' messages to an AI workflow**, so a mistake here can act on real people. Please read this guide fully before opening a pull request.

---

## Table of Contents

- [Before You Start](#before-you-start)
- [Scope of Contributions](#scope-of-contributions)
- [Development Setup](#development-setup)
  - [Requirements](#requirements)
  - [Local start](#local-start)
  - [Environment variables](#environment-variables)
- [Project Structure](#project-structure)
- [Coding Guidelines](#coding-guidelines)
  - [General](#general)
  - [Linting and types](#linting-and-types)
  - [Naming conventions](#naming-conventions)
  - [Texts](#texts)
  - [Logging and errors](#logging-and-errors)
  - [Commands and events](#commands-and-events)
  - [Database migrations](#database-migrations)
  - [Dependencies](#dependencies)
  - [Commits](#commits)
- [Testing Requirements](#testing-requirements)
- [Secure Contributing](#secure-contributing)
- [Submitting Changes](#submitting-changes)
- [Reporting Security Vulnerabilities](#reporting-security-vulnerabilities)

---

## Before You Start

- Check the [open issues](../../issues) and [pull requests](../../pulls) to avoid duplicating work.
- For large changes or new features, open an issue first to discuss the approach before investing time in code.
- By contributing, you agree to the project [License](LICENSE) and [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Scope of Contributions

Contributions that are **welcome**:

- Bug fixes (with a regression test)
- Security improvements or hardening
- Test coverage gaps
- Documentation corrections
- Translations: a new language is one file in `src/locales/` (see [docs/I18N.md](docs/I18N.md))
- Features that fit a self-hosted bot for a single server

Contributions we will **not accept**:

- Anything that logs or stores the content of users' messages beyond what the bot keeps today (see [SECURITY.md](SECURITY.md))
- Analytics, tracking or telemetry that leaves the host
- A moderation action that skips the permission and role hierarchy checks
- Features that need the bot to run on more than one server, or a hosted instance
- Text shown on Discord that is written in the code instead of the locale files

---

## Development Setup

### Requirements

| Tool | Version |
|---|---|
| Node.js | ≥ 22.0.0 |
| npm | ≥ 11.12.1 |
| PostgreSQL | ≥ 14 — or use the one in `docker-compose.yml` |
| A Discord application with a bot token | for a test server of your own |
| n8n | an instance with the workflows from `docs/` imported |
| Docker & Docker Compose | optional — for containerised testing |

### Local start

```bash
npm ci
cp .env.example .env    # then fill it in
npm run dev             # builds, starts the bot and restarts it on changes
```

Slash commands are registered with Discord on every start. The database schema comes from the SQL files in `migrations/`; the Docker image applies them on start, and without Docker you apply them with `npm run build && npm run migrate:up`.

Setting up the Discord application, the bot's permissions and the n8n workflows is described in [docs/SETUP.md](docs/SETUP.md) and [docs/N8N_INTEGRATION.md](docs/N8N_INTEGRATION.md).

### Environment variables

Every variable and its default is documented inline in [`.env.example`](.env.example). A new variable goes there too, with a comment, and into `src/config/config.ts`, which validates the required ones at startup.

Security-sensitive variables (never commit these):

```
DISCORD_TOKEN=
N8N_API_KEY=
DB_PASSWORD=
DISCORD_CLIENT_SECRET=
DASHBOARD_SESSION_SECRET=
```

The n8n webhook URLs (`N8N_WORKFLOW_URL`, `N8N_MODERATION_WORKFLOW_URL`) are secrets as well.

---

## Project Structure

```
src/
  index.ts           # entrypoint: config check, client, command registration
  config/            # env-var parsing and validation
  events/            # Discord event handlers (messages, interactions, reactions)
  slashcommands/     # one file per slash command
  utils/             # n8n client, AI moderation, moderation actions, rate limiter, logger, i18n
  db/                # connection and repositories
  jobs/              # periodic cleanup and mute reconciliation
  api/               # health endpoint and the dashboard
  locales/           # translations, one file per language
  types/             # shared type definitions

migrations/          # SQL migrations, applied in order
tests/               # unit tests (Vitest), one file per module
docs/                # setup, deployment and feature guides, n8n workflows
```

The full map is in [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md).

---

## Coding Guidelines

### General

- **TypeScript** in strict mode everywhere — no `any` types and no type assertions without a comment explaining why.
- Keep functions small and single-purpose.
- No dead code or commented-out blocks in submitted PRs.
- Comments say why, not what.
- Match the existing code style; ESLint is the source of truth.

### Linting and types

```bash
npm run lint
npm run typecheck
```

Both must pass before you open a PR; CI runs them on every pull request.

### Naming conventions

| Context | Convention |
|---|---|
| Files | `kebab-case.ts`; an event handler is named after its Discord event (`messageCreate.ts`), a slash command after the command (`flushmemory.ts`) |
| Variables / functions | `camelCase` |
| Types / interfaces / classes | `PascalCase` |
| Constants | `UPPER_SNAKE_CASE` |
| Environment variables | `UPPER_SNAKE_CASE` |

### Texts

Everything the bot writes on Discord or shows in the dashboard comes from the locale files, never from a string in the code. Add the key to every file in `src/locales/` and read it with `t()`; `npm test` fails when a language misses a key. Log messages stay in English. See [docs/I18N.md](docs/I18N.md).

### Logging and errors

- Log through `src/utils/logger.ts`, with context: the user ID, the command, the guild.
- Do not log the content of a user's message, a token, a password or a full webhook URL.
- A user never sees a raw error: catch it, log the detail and reply with a translated message.

### Commands and events

- A slash command is one file in `src/slashcommands/` that exports a `SlashCommand` (`src/types/discord.ts`), and an entry in the `slashCommands` list in `src/index.ts`.
- An event handler is one file in `src/events/` that exports a `BotEvent`.
- A command that acts on a member goes through `src/utils/moderation-actions.ts`, which checks the invoker's permission and the role hierarchy. Do not call Discord's kick, ban or timeout directly.

### Database migrations

A schema change is a new numbered SQL file in `migrations/`, never an edit of one that has shipped. Check it both ways before you open the PR:

```bash
npm run build
npm run migrate:up
npm run migrate:down
```

Queries pass their values as parameters (`$1`, `$2`); never build SQL by concatenating input. [docs/DATABASE.md](docs/DATABASE.md) describes the schema.

### Dependencies

- **Justify every new dependency** in the PR description.
- Prefer Node.js built-ins and already-present packages.
- Versions are exact in `package.json` (`.npmrc` sets `save-exact`), and the lockfile is committed.
- `.npmrc` also sets `min-release-age=7` and `ignore-scripts=true`: a version younger than a week does not install, and install scripts do not run.
- Run `npm audit` before submitting — flag any findings in the PR.

### Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) style:

```
feat: add a per-channel exemption to AI moderation
fix: count a warning once when the database reconnects
docs: describe the dashboard's allowed roles
test: cover role hierarchy for reaction role bindings
security: refuse a dashboard session secret under 32 characters
```

Keep commits focused — one logical change per commit. The PR title follows the same format: release notes are generated from PR titles.

---

## Testing Requirements

**Every change must be covered by tests.** This is not optional.

```bash
npm test             # the whole suite, once
npm run test:watch   # while you work
```

The suite must pass **with zero failures** before submitting.

- **Bug fixes** — add a regression test that fails on the original code and passes on the fix.
- **New commands and handlers** — test the success path, the permission and hierarchy refusals, and the error path.
- **Anything that decides who may do what** — test it as a pure function with the whole matrix, as `tests/dashboard-rbac.test.ts` and `tests/permissions.test.ts` do.
- Prefer real logic over excessive mocking — mocks hide bugs. If you must mock, document why.

Tests do not replace a run on Discord. Before you ask for review, try the change on a test server: in a DM, in a channel, as a member without the role, and with n8n switched off.

---

## Secure Contributing

Exemplar acts on people and handles their messages. The following rules apply strictly.

### Permissions

- Do not add a way to moderate that bypasses `src/utils/moderation-actions.ts`.
- Do not widen what the bot asks for on the server. A change that needs a new Discord permission or gateway intent says so in the PR description and in [docs/SETUP.md](docs/SETUP.md).
- The dashboard only reads. An endpoint that changes anything needs a dedicated issue first.

### Messages and privacy

- Message content goes to the n8n workflow and nowhere else. Do not log it, and do not store it beyond the conversation history the bot keeps today.
- Do not add an outbound connection other than Discord, the configured n8n webhooks and the database.

### Input handling

- Treat everything from Discord and from n8n as untrusted: message content, command options, a workflow's answer.
- An AI moderation verdict is only ever `allow`, `warn`, `timeout` or `delete`. Do not let a workflow's answer choose anything else.

### Secrets and credentials

- **Never commit secrets**, credentials, tokens or webhook URLs — not in code, not in comments, not in test fixtures.
- Use environment variables for all secrets. The `.env` file is in `.gitignore`.
- If you accidentally commit a secret, treat it as compromised immediately and rotate it. Then open a private security report.

### AI-assisted code

- AI-generated code **must be reviewed line by line** before submission.
- Files that decide who may do what (`utils/moderation-actions.ts`, `api/dashboard/rbac.ts`, `api/dashboard/session.ts`) must be reviewed with extra care.
- Do not submit AI output that you cannot explain and defend in a PR review. Tests are the primary guard against code that only looks right.

### Pull request security checklist

The pull request template carries this list; confirm it for every PR:

```
- [ ] No secrets, tokens, or webhook URLs are committed (`.env.example` is sanitised)
- [ ] No new unvalidated environment variable is introduced; any new one is documented in `.env.example`
- [ ] `npm audit` shows no new high/critical findings
- [ ] ESLint passes with zero warnings
- [ ] TypeScript compiles with zero errors
```

---

## Submitting Changes

1. **Fork** the repository and create a branch from `dev` (not `main`).
2. Branch naming: `fix/short-description`, `feat/short-description`, `docs/short-description`, `security/short-description`.
3. Make your changes, following this guide.
4. Run the tests, the linter and the type check.
5. Open a pull request against the `dev` branch.
6. Fill out the PR template completely — incomplete PRs will be asked to add missing information.
7. Respond to review comments. PRs that are not addressed within 30 days may be closed.

`main` holds released code and changes only through a release pull request from `dev`.

### PR description must include

- **What** changed and **why**.
- A reference to the related issue (`Closes #123` or `Relates to #123`).
- For a schema change: the migration, and that it applies and rolls back.
- For dependency additions: justification and `npm audit` output.

---

## Reporting Security Vulnerabilities

**Do not open a public issue for security vulnerabilities.**

Follow the process in [SECURITY.md](SECURITY.md).
