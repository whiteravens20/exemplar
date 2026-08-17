---
name: Bug Report
about: Report a reproducible bug in the bot
title: '[BUG] '
labels: bug
assignees: ''
---

> **Security vulnerability?** Do not open a public issue.
> Use [private vulnerability reporting](../../security/advisories/new) instead.

## Bug Description
A clear and concise description of what the bug is.

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happens. Include any error messages or unexpected output.

## Affected Area
- [ ] AI assistant (n8n chat flow)
- [ ] AI moderation
- [ ] Slash commands
- [ ] Web dashboard
- [ ] Database / migrations
- [ ] Deployment (Docker, health check)
- [ ] Other

## Environment

| Field | Value |
|---|---|
| Node.js version | e.g. 22.x |
| Bot version | from `package.json` |
| Operating System | e.g. Ubuntu 24.04 |
| Deployment method | Docker / direct Node.js |
| Discord.js version | check `package.json` |
| PostgreSQL version | e.g. 16 (if persistent storage is enabled) |
| n8n version | e.g. 1.x (if the AI assistant or moderation is involved) |
| n8n reachable | does `N8N_WORKFLOW_URL` respond? yes / no |
| `AI_MODERATION_MODE` | off / … (if moderation is involved) |
| `DASHBOARD_ENABLED` | true / false (if the dashboard is involved) |

## Logs
```
Paste relevant log fragments here (remove any sensitive values — tokens, IDs, etc.)
```

## Screenshots
If applicable, add screenshots to help explain the problem.

## Additional Context
Anything else that may help reproduce or diagnose the issue.
