# Security — Exemplar

## Reporting a vulnerability

Report vulnerabilities privately through GitHub's [private vulnerability reporting](https://github.com/whiteravens20/exemplar/security/advisories/new). Please do not open a public issue, discussion or pull request for a security bug.

Include the version or commit you tested, how the bot runs (Docker or directly on Node.js), the steps that reproduce the problem and the impact you expect. You will get a first reply within a week. A confirmed issue is fixed in a new release, and the advisory credits you unless you ask otherwise.

## Supported versions

Only the latest release receives security fixes.

## Security checklist

What the code guarantees today, and what it deliberately does not protect against.

### Access and abuse

- [x] The assistant answers in DMs only; a mention in a server channel gets a fixed reply that points there
- [x] `ALLOWED_ROLES_FOR_AI` limits the assistant to members who hold one of the listed roles on `DISCORD_SERVER_ID`; left empty, anyone who can DM the bot may use it
- [x] 5 assistant messages per minute per user, counted in PostgreSQL, and in memory while the database is away
- [x] A message longer than 4,000 characters is refused before it reaches n8n
- [x] Slash commands run in DMs with the bot; used in a server channel they return the mention reply instead
- [x] Every moderation command checks the invoker's server permission and role hierarchy, and that the bot itself may act on the target, before a kick, ban, timeout or warning
- [x] Reaction roles check role hierarchy when a binding is made and again before every role change
- [x] The bot needs neither Administrator nor Manage Server; [docs/SETUP.md](docs/SETUP.md) lists the permissions it is invited with

### Secrets and configuration

- [x] Every secret comes from the environment: `DISCORD_TOKEN`, `N8N_API_KEY`, `DB_PASSWORD`, `DISCORD_CLIENT_SECRET`, `DASHBOARD_SESSION_SECRET`. `.env` is git-ignored and [`.env.example`](.env.example) holds no real value
- [x] Required settings are checked at startup; the bot exits instead of running without them
- [x] The n8n webhook URLs are treated as secrets: a log line has the host, and `[REDACTED]` in place of the path

### What is logged

- [x] The content of a user's message is not logged; the log has the user ID and the message length
- [x] Of the assistant's reply, the first 100 characters are logged
- [x] Logs stay on the host, in `logs/`; nothing is sent to a third party

### n8n

- [x] Requests to the workflows carry `N8N_API_KEY` in the `X-API-Key` header, for the webhook's Header Auth to check
- [x] A request times out after 2 minutes for the assistant and 5 minutes for AI moderation
- [x] A failed request is retried up to 3 times with exponential backoff, and only for errors a retry can help
- [x] AI moderation sends a limited number of messages at a time (`AI_MOD_MAX_CONCURRENT`)
- [x] In `shadow` mode AI moderation only posts its verdicts to the mod-log channel: no DM, no database write, no action on Discord

### Dashboard

Off by default (`DASHBOARD_ENABLED`). When it is on:

- [x] Sign-in is Discord OAuth2, with a signed `state` value against CSRF
- [x] Access is decided from the bot's own view of the member, not from anything the browser sends: the server owner, a member with Administrator or Manage Server, or a holder of one of `DASHBOARD_ALLOWED_ROLES`. Leaving the server ends it on the next check
- [x] Sessions are signed cookies (HMAC-SHA256, compared in constant time) that expire; there is no session store
- [x] The bot does not start with the dashboard on and a session secret shorter than 32 characters
- [x] It only reads: no endpoint changes a setting or moderates anyone, and its config page shows the settings without secrets
- [x] Per-IP rate limits: 300 requests a minute overall, 120 on the API, 10 on sign-in
- [x] Headers: a Content-Security-Policy limited to its own origin, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, and HSTS when `DASHBOARD_COOKIE_SECURE` is on

Details: [docs/DASHBOARD.md](docs/DASHBOARD.md).

### Data

- [x] Database queries pass their values as parameters
- [x] Conversation history: the last 20 messages per user, kept for 24 hours; `/flushmemory` clears it on the bot and in n8n
- [x] Warnings expire after 30 days, usage analytics after 90

### Supply chain

- [x] Exact versions in `package.json` and a committed lockfile
- [x] `.npmrc`: `ignore-scripts=true` and `min-release-age=7`
- [x] 7-day dependency quarantine — Dependabot `cooldown: default-days: 7` on every ecosystem, so a freshly published version is never proposed. Security advisories are exempt and land immediately
- [x] `npm audit` on every push and pull request and once a week: a production dependency fails the build from a moderate finding, a development dependency from a high one. An advisory with no installable fix and no reachable code path can be allowlisted on its own in `.github/scripts/audit-allowlist.json`, with a justification and an expiry date
- [x] Registry signatures verified in CI (`npm audit signatures`)
- [x] Dependency review on pull requests, CodeQL, and Trivy scans of the repository and of the built image
- [x] Workflow actions pinned to commit SHAs, each checked against its version tag on every run

The `overrides` block in `package.json` is not covered by Dependabot. Review it by hand in every dependency sweep: a stale pin there can force a transitive dependency down into a vulnerable range.

### Container

- [x] Multi-stage build; npm is removed from the runtime image
- [x] Runs as a non-root user
- [x] Alpine base image, pinned by version and digest
- [x] `docker-compose.yml` runs the bot with a read-only root filesystem, all capabilities dropped, `no-new-privileges` and `/tmp` mounted `noexec`

### What this does NOT protect against

| Threat vector | Why it is out of scope |
|---|---|
| The n8n instance and the model behind it | Every assistant message, and every message AI moderation analyses, goes to your n8n workflow and from there to the model it calls. What they keep and who can read it is outside the bot |
| A leaked `DISCORD_TOKEN` | Whoever holds it is the bot, with every permission the bot was invited with. Reset the token in the Discord Developer Portal |
| A webhook that does not check the key | The bot sends `N8N_API_KEY`; a workflow without Header Auth answers anyone who learns its URL |
| Messages written to steer the model | A user can talk the assistant into answers its instructions forbid, or a channel message can argue for its own verdict. An AI moderation verdict is only ever allow, warn, timeout or delete, and `shadow` mode shows the verdicts before any is acted on |
| Server administrators | The bot trusts the server's own roles and hierarchy. Whoever can change them decides what the bot allows |
