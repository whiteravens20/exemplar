# Advanced Logging Dashboard

A secure, opt-in web interface for reviewing the bot's moderation activity:
human and AI moderation actions, AI moderation decisions (with reasoning), and a
per-user history view. It is read-only and disabled by default.

> Implements [issue #18](https://github.com/whiteravens20/exemplar/issues/18).

## What it shows

- **Overview** — totals and bar charts: events by type, by severity, by source
  (human / AI), per-day activity, and the most-flagged users.
- **Logs** — every moderation event with filtering (date range, user, channel,
  event type, severity) and free-text search. Click a row to see the full
  detail, including the **AI reasoning**, **triggered rule**, and **action
  taken**. Auto-refreshes (~5s, pausable) for near-real-time review.
- **User lookup** — for a given Discord user ID: live **ban** and **mute**
  status, the list of **active warnings**, and that user's recent event history.
- **Users feedback** — a feed of post-like cards. Reserved for the
  [User Feedback & Rating System (#17)](https://github.com/whiteravens20/exemplar/issues/17);
  empty until that feature ships (see [Extending for #17](#extending-for-issue-17)).
- **Config** — a read-only, secret-free view of the bot's effective settings.

## Data model

All events are appended to the `moderation_logs` table (migration
`005_dashboard_logs.sql`). The table is intentionally denormalized — each row is
an immutable snapshot — and `event_type` is an open string so new event sources
can be added without a migration.

| column | notes |
| --- | --- |
| `event_type` | `warn`/`ban`/`kick`/`mute`/`unmute`/`unban`/`delete`/`ai_flag` (reserved: `feedback`) |
| `severity` | `info`/`low`/`medium`/`high`/`critical` |
| `actor_type` | `human`/`ai`/`system` |
| `actor_id`, `actor_label` | who performed the action |
| `target_user_id`, `target_username` | who it affected |
| `channel_id`, `action`, `reason` | context |
| `ai_reasoning`, `ai_rule` | AI-decision transparency |
| `metadata` | JSONB for extra detail (e.g. timeout duration) |

Events are written from the shared moderation layer (`src/utils/moderation-
actions.ts`) and the AI moderation path (`src/utils/ai-moderation.ts`), so both
manual commands and automated moderation are captured. Command usage is read
from the existing `command_usage` table. Rows are pruned after **90 days** by
the database cleanup job.

## Authentication & authorization

- **Login** is via Discord OAuth2 (`identify` scope only).
- **Authorization** is decided from the bot's own view of the configured guild —
  not from OAuth scopes. A user may view the dashboard if they are the **guild
  owner**, hold **Administrator** or **Manage Server**, or hold one of the roles
  in `DASHBOARD_ALLOWED_ROLES` (falling back to `ALLOWED_ROLES_FOR_AI`).
- Access is re-checked against live guild membership on every request (with a
  short cache), so removing a user's roles revokes access promptly.

## Security

The dashboard exposes moderation data, so it is hardened deny-by-default:

- Disabled unless `DASHBOARD_ENABLED=true`; required secrets are validated at
  startup (the bot refuses to boot with a missing/weak `DASHBOARD_SESSION_SECRET`).
- Stateless sessions in an `HttpOnly`, `SameSite=Lax` cookie, HMAC-SHA256 signed
  and verified in constant time; `Secure` when `DASHBOARD_COOKIE_SECURE=true`.
- CSRF-protected OAuth via a signed, single-use `state` nonce.
- Strict security headers (CSP `self`-only, `frame-ancestors 'none'`, `nosniff`,
  `Referrer-Policy: no-referrer`, HSTS when secure); no CORS.
- All query parameters are validated/clamped; all SQL is parameterized.
- Per-IP rate limiting on the auth and API endpoints.
- `/api/config` returns a hard allowlist of non-secret fields only.

> Run the dashboard behind HTTPS in production (set `DASHBOARD_COOKIE_SECURE=true`
> and point `DASHBOARD_OAUTH_REDIRECT_URI` / `DASHBOARD_PUBLIC_BASE_URL` at your
> HTTPS origin).

## Setup

1. **Discord application** — in the
   [Developer Portal](https://discord.com/developers/applications) → your app →
   **OAuth2**:
   - Copy the **Client Secret** into `DISCORD_CLIENT_SECRET`.
   - Add a **Redirect** that exactly matches `DASHBOARD_OAUTH_REDIRECT_URI`
     (e.g. `https://dash.example.com/callback`).
2. **Environment** — set the dashboard variables (see `.env.example`):

   ```dotenv
   DASHBOARD_ENABLED=true
   DASHBOARD_PORT=3001
   DISCORD_CLIENT_SECRET=...
   DASHBOARD_OAUTH_REDIRECT_URI=http://localhost:3001/callback
   DASHBOARD_PUBLIC_BASE_URL=http://localhost:3001
   DASHBOARD_SESSION_SECRET=$(openssl rand -hex 32)
   DASHBOARD_ALLOWED_ROLES=        # optional; falls back to ALLOWED_ROLES_FOR_AI
   DASHBOARD_COOKIE_SECURE=false   # true behind HTTPS
   ```
3. **Migrate & run**:

   ```bash
   npm run build
   npm run migrate:up      # creates moderation_logs
   npm start
   ```
4. Open `DASHBOARD_PUBLIC_BASE_URL` and sign in with Discord.

The dashboard listens on its own port, separate from the health-check server
(`HEALTH_CHECK_PORT`). When running in Docker, publish `DASHBOARD_PORT`.

## Extending for issue #17

The User Feedback & Rating System (#17) plugs in with minimal work:

- **Storage** — record feedback as `moderation_logs` rows with
  `event_type = 'feedback'` (already a reserved value), putting the rating and
  comment in `metadata` — or add a dedicated `feedback` table.
- **API** — replace the stub in `GET /api/feedback` (currently returns
  `{ items: [], notImplemented: true }`) with real data. The frontend already
  renders each item as a post card from this shape:

  ```jsonc
  { "items": [
    { "userId": "…", "username": "…", "rating": 5,
      "comment": "…", "createdAt": "ISO-8601" }
  ] }
  ```
- **UI** — the **Users feedback** tab and its card feed already exist; no
  frontend changes are required to start showing submissions.
