# AI-driven automated moderation

This document covers the optional AI moderation feature added in **v3.1.0**
(issue [#16](https://github.com/whiteravens20/exemplar/issues/16)). It walks
through the architecture, the bot ↔ n8n contract, the n8n workflow setup, and
the rollout procedure.

If you have not yet set up the **chat** n8n workflow, do that first (see
[N8N_INTEGRATION.md](./N8N_INTEGRATION.md) and [SETUP.md §C](./SETUP.md)). AI
moderation reuses your existing n8n instance and `N8N_API_KEY`, but lives in a
**separate workflow** with its own URL.

---

## What it does

When AI moderation is enabled the bot POSTs every eligible guild message to a
dedicated n8n workflow. The workflow asks an LLM to classify the message, and
returns a structured verdict: `allow`, `warn`, `timeout`, or `delete`. The bot
then executes the verdict through the exact same action layer the human
moderators' slash commands use, so the side effects are identical (DM to the
target, mod-log entry, DB write where relevant).

On top of that the bot enforces a **graduated escalation ladder** across every
warning, regardless of source:

| Trigger                                | Result                                           |
|----------------------------------------|--------------------------------------------------|
| 3 active warnings (default, configurable) | Auto-mute. Duration = time until the user's oldest active warning expires, capped at Discord's 28-day max. |
| Active count drops below the threshold | Auto-unmute on the next reconcile tick (~hourly), or sooner if Discord's natural timeout expiry already lifted it. |
| 100 historical warnings (default, configurable; lifetime, includes expired) | Auto-ban. Supersedes the mute path. |

AI verdicts and human `/warn`s share the same `warnings` table, so a user with
2 AI warns + 1 human warn hits the mute threshold identically to one with 3
AI warns.

---

## Bot ↔ n8n contract

### Request (bot → n8n)

`POST` to `N8N_MODERATION_WORKFLOW_URL`. Same `X-API-Key` header as the chat
workflow (`N8N_API_KEY`).

```jsonc
{
  "platform": "discord",
  "mode": "moderate",
  "userId": "123456789012345678",
  "userName": "alice",
  "message": "<raw message content>",
  "channelId": "123456789012345678",
  "channelName": "general",
  "serverId": "<DISCORD_SERVER_ID>",
  "timestamp": "2026-05-25T14:32:11.000Z",
  // Bot-provided context so the LLM can ground its verdict:
  "recentWarnings": [
    { "reason": "spam links in #general", "issuedAt": "2026-05-20T14:01:00Z" },
    { "reason": "insult", "issuedAt": "2026-05-22T09:33:00Z" }
  ],
  "serverRules": "1. No slurs. 2. No NSFW outside #adult. 3. ..."
}
```

`recentWarnings` is the user's last 5 warnings (any age, AI + human) so the
LLM can judge "repeated rule-breaking" with evidence instead of guessing.
`serverRules` is whatever the operator set in `MOD_RULES_TEXT`; empty string
when unset — the LLM should then fall back to the generic baseline in its
system prompt.

### Response (n8n → bot)

The bot reads `result.data.verdict`:

```jsonc
{
  "verdict": {
    "action": "allow" | "warn" | "timeout" | "delete",
    "reason": "<short, user-visible reason>",
    "duration": "10m"
  }
}
```

- `action: "allow"` — no-op, no logging.
- `action: "warn"` — `applyWarn` is called. May trigger the escalation ladder
  (auto-mute or auto-ban) if thresholds are hit.
- `action: "timeout"` — requires `duration` in the format `30s`, `10m`, `2h`,
  `1d`. Discord caps timeouts at 28 days.
- `action: "delete"` — the offending message is deleted; the user is DM'd with
  the channel reference and a content preview so they know which message of
  theirs was removed.
- `action: "ban"` is **not** in the AI contract. Bans only happen via the
  100-historical-warnings rule, never directly from a verdict.

A malformed verdict (missing/unknown `action`, `timeout` without a parseable
`duration`) is logged at `error` and treated as `allow`. Use this fail-open
behaviour during testing so a broken workflow doesn't take the moderation
surface down.

---

## n8n workflow setup (step by step)

Build the moderation workflow from scratch alongside your existing chat
workflow. Total: 3 nodes.

### Node 1 — Webhook trigger

1. Add a **Webhook** node. Settings:
   - **HTTP Method**: `POST`
   - **Path**: `moderation` (or anything you like — n8n will give you the
     final URL)
   - **Authentication**: `Header Auth`
     - Header name: `X-API-Key`
     - Header value: same secret you put in `N8N_API_KEY`
   - **Response Mode**: `When Last Node Finishes`
   - **Response Code**: `200`
   - **Response Data**: `First Entry JSON`
2. Save and activate the workflow. Copy the **Production URL** shown by the
   Webhook node into your `.env` as `N8N_MODERATION_WORKFLOW_URL`.

### Node 2 — LLM classifier

Pick whichever LLM provider you already have credentials for. The examples
below all produce the same output shape — only the node type differs.

**System prompt** (paste verbatim into the model's system / instruction field):

```
You are a Discord content moderator for a single Discord server. For each
incoming message decide one of four actions:

- "allow"   — the message is fine.
- "warn"    — the message breaks community norms (light insult, mild spam,
              off-topic noise). The user receives a tracked warning.
- "timeout" — the message is bad enough to silence the user temporarily
              (harassment, repeated rule-breaking, NSFW where forbidden).
              You MUST include a duration: "30s", "5m", "1h", "1d". Cap
              your suggestion at "1d" unless extreme.
- "delete"  — the message itself must be removed but the user is otherwise
              fine (spam links, leaked secrets, accidental personal info).

Context the bot will give you in each request:

- "serverRules": the operator's server-specific rules. If present, treat
  these as the primary authority. If empty, fall back to the generic
  community baseline below.
- "recentWarnings": the user's last 5 warnings (any age) with reason and
  ISO timestamp. Use these to judge "repeated" rule-breaking objectively:
  a clean user gets the benefit of the doubt; a user with 3 recent warns
  for similar behaviour should escalate to "timeout".

Generic community baseline (apply when serverRules is empty):

- No slurs, harassment, or targeted hate.
- No spam, mass-mentions, or link-flooding.
- No NSFW content outside channels explicitly designated for it.
- No doxxing or leaking of personal information.
- No illegal content.

Return ONLY valid JSON, no markdown fences, no commentary. Shape:

  {"action": "<action>", "reason": "<short Polish-language reason>", "duration": "<only if action is timeout>"}

Be conservative: prefer "allow" over false positives. The bot will fail
open on malformed JSON, so partial outputs are worse than "allow".
```

**User prompt** (what the LLM actually classifies):

```
Channel: {{$json.channelName}}
User:    {{$json.userName}}
Server rules: {{$json.serverRules}}
Recent warnings: {{JSON.stringify($json.recentWarnings)}}
Message: {{$json.message}}
```

**Provider-specific node settings**:

| Provider  | Node                  | Model               | Settings                          |
|-----------|-----------------------|---------------------|-----------------------------------|
| OpenAI    | "OpenAI Chat Model"   | `gpt-4o-mini`       | Temperature `0.1`, JSON mode on   |
| Anthropic | "Anthropic Chat Model"| `claude-haiku-4-5`  | Temperature `0.1`                 |
| Ollama    | "Ollama Chat Model"   | `llama3.1:8b`       | Temperature `0.1`, format `json`  |

For OpenAI and Ollama, turn on **JSON mode** / `format: json` so the model is
forced to return valid JSON. For Anthropic, the system prompt's strict
instruction is enough in practice.

### Node 3 — Code (verdict parser)

Add a **Code** node (JavaScript) after the LLM. Paste this verbatim — it
parses the LLM output, validates it, and shapes it into the exact response
the bot expects:

```js
const raw = $input.first().json;

// Pick the LLM output regardless of which provider you're using.
const candidates = [
  raw.message?.content,
  raw.text,
  raw.content,
  raw.output_text,
  raw.choices?.[0]?.message?.content,
];
let text = candidates.find((c) => typeof c === 'string' && c.length > 0) ?? '';

// Strip ```json fences if the model added them anyway.
text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

const ALLOWED = new Set(['allow', 'warn', 'timeout', 'delete']);
const DURATION_RE = /^\d+[smhd]$/;

function failOpen(reason) {
  return [{ json: { verdict: { action: 'allow', reason: `parse-fallback: ${reason}` } } }];
}

let parsed;
try {
  parsed = JSON.parse(text);
} catch (err) {
  return failOpen('invalid JSON');
}

if (!parsed || typeof parsed !== 'object') return failOpen('not an object');
if (!ALLOWED.has(parsed.action)) return failOpen('unknown action');
if (parsed.action === 'timeout') {
  if (typeof parsed.duration !== 'string' || !DURATION_RE.test(parsed.duration)) {
    return failOpen('timeout missing valid duration');
  }
}

const verdict = { action: parsed.action };
if (typeof parsed.reason === 'string') verdict.reason = parsed.reason;
if (typeof parsed.duration === 'string') verdict.duration = parsed.duration;

return [{ json: { verdict } }];
```

### Wire up

Connect: **Webhook → LLM → Code**. The `When Last Node Finishes` response
mode on the Webhook node will return the Code node's output to the bot
automatically.

Activate the workflow.

---

## Configuration reference

| Env var                       | Required           | Default | Notes |
|-------------------------------|--------------------|---------|-------|
| `AI_MODERATION_MODE`          | yes (to enable)    | `off`   | `off` / `shadow` / `enforce` |
| `N8N_MODERATION_WORKFLOW_URL` | yes (to enable)    | _empty_ | If unset, AI mod stays disabled even in `shadow`/`enforce` |
| `N8N_API_KEY`                 | yes (to enable)    | _empty_ | Reused from the chat workflow setup |
| `MOD_LOG_CHANNEL_ID`          | **yes**            | _empty_ | Mandatory once enabled — in shadow mode it's the only place verdicts surface |
| `AI_MOD_INCLUDE_CHANNELS`     | **yes** (to act)   | _empty_ | CSV of channel IDs that AI moderation actively analyses. **Strict opt-in** — an empty list means nothing is analysed. Add only the channels where AI moderation should run, leaving news/announcement/read-only channels off the list. |
| `AI_MOD_EXEMPT_ROLES`         | no                 | _empty_ | CSV of role IDs whose holders are skipped (mods, trusted bots, etc.) |
| `AI_MOD_MUTE_THRESHOLD`       | no                 | `3`     | Active warnings that trigger auto-mute |
| `AI_MOD_BAN_THRESHOLD`        | no                 | `100`   | Historical warnings that trigger auto-ban |
| `MOD_RULES_TEXT`              | no                 | _empty_ | Server-specific rules as a plain string (use `\n` for line breaks). Passed to the LLM as `serverRules` in the payload. Empty = LLM uses generic baseline. |
| `DISCORD_SERVER_ID`           | yes (bot-wide)     | _empty_ | The single configured server |

Other relevant Discord settings (already enabled if you have chat working):
**Message Content** privileged intent, **Server Members** intent. No new
intent is required for AI moderation.

---

## Rollout: shadow → enforce

### 1. Shadow mode

Start here. The bot calls n8n, parses verdicts, and writes a clearly-marked
`🤖 [SHADOW]` embed to `MOD_LOG_CHANNEL_ID` showing what it **would** have
done — but takes no Discord action, sends no DMs, writes nothing to the
warnings table.

```
AI_MODERATION_MODE=shadow
N8N_MODERATION_WORKFLOW_URL=https://your-n8n/webhook/moderation
MOD_LOG_CHANNEL_ID=<your-mod-log-channel-id>
AI_MOD_INCLUDE_CHANNELS=<channel_id_to_test_in>
```

`AI_MOD_INCLUDE_CHANNELS` is strict opt-in — without at least one channel
ID here, the bot analyses nothing. List your test channel first; expand to
the rest of the chat channels once verdict quality is good.

Post a few test messages on the server — including some you'd expect to be
`warn`/`timeout`/`delete` and some clearly fine. Verify in your mod-log:

- Embeds tagged `🤖 [SHADOW]` appear with the right action, reason, channel
  and content preview.
- No actual mutes or deletes happen.
- The footer reads "Tryb shadow — żadna akcja nie została wykonana."

Tune the system prompt or model until you're happy with the verdict
distribution. Watch for: too many false positives (model is over-eager),
verdicts in the wrong language, or chronic `parse-fallback` reasons (LLM
isn't returning clean JSON — turn on JSON mode).

### 2. Enforce mode

Once shadow verdicts look right:

```
AI_MODERATION_MODE=enforce
```

Restart the bot. Verify with controlled tests:

- A clean message → still allowed.
- A `warn`-worthy test message from a test alt → user gets a warning DM,
  `Warn` entry in mod-log with `Moderator: AI moderation`, row in `warnings`.
- A `timeout` verdict → user is muted, DM'd with duration, mod-log entry.
- A `delete` verdict → message vanishes, user gets a DM with channel ref +
  content preview, mod-log entry.

### 3. Escalation ladder

Exercise the escalation paths with a test alt account so you don't ban
yourself or a real member:

- **3 active warns → auto-mute**: with `AI_MOD_MUTE_THRESHOLD=3` (default),
  issue 3 `/warn`s as a human moderator. The third triggers an auto-mute;
  the mod-log shows both the `Warn` and the `Mute (Timeout)` entries; a row
  appears in `ai_mod_active_mutes`.
- **Mute lifts when a warn fades**: fast-forward by running `UPDATE warnings
  SET expires_at = NOW() - '1 minute'::interval WHERE id = <id>;` on the
  oldest warning. Within an hour the reconciliation job runs, the alt is
  untimed-out and the row is removed.
- **100 historical → auto-ban**: do not test this with the production
  threshold. Temporarily set `AI_MOD_BAN_THRESHOLD=5`, issue 5 warns, watch
  the alt get banned with `Moderator: AI moderation (auto-ban)`. Reset the
  threshold afterwards.

---

## Operational notes

- **Cost**: roughly proportional to messages × LLM token cost per call. For
  a small server with `gpt-4o-mini`, expect ≪ \$1/day. Ollama is free but
  slower. `AI_MOD_INCLUDE_CHANNELS` is strict opt-in — list only the
  channels you actually want analysed. High-volume read-only channels
  (announcements, news, bot-output) stay out of the n8n round-trip simply by
  not being listed.
- **Latency**: 1–3 s for cloud LLMs, 5–15 s for local Ollama on modest
  hardware. The bot fires moderation requests fire-and-forget so chat
  latency is unaffected, but deletes / timeouts may land a second or two
  after the offending message.
- **When n8n is unreachable**: the bot logs `AI moderation: n8n returned
  failure` and continues. No action is taken on that message. Chat
  functionality is unaffected.
- **Rate limits**: the existing `N8NClient` retries 5xx / 429 with
  exponential backoff and bails after 3 attempts. If your LLM provider
  rate-limits you, you'll see those errors in the bot log.
- **Restart resilience**: when the bot restarts with an existing
  `ai_mod_active_mutes` row, the reconciliation job runs once after the
  client is `ready` and re-evaluates each row — extending the Discord
  timeout if it has drifted, lifting it if active warnings have dropped.

---

## Disabling

Set `AI_MODERATION_MODE=off` (or unset both env vars) and restart. Existing
warnings remain in the database; the escalation ladder still fires on
`/warn` (the rule lives in the action layer, not in the AI orchestrator).
To also disable the escalation ladder, set
`AI_MOD_MUTE_THRESHOLD=999999` and `AI_MOD_BAN_THRESHOLD=999999`.
