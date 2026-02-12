# 🔒 Security Policy

## 🛡️ Our Security Commitment

Security is a top priority for the Discord AI Assistant Bot project. We take the protection of our users' data and the integrity of our codebase seriously. This document outlines our security practices, how to report vulnerabilities, and what you can expect from us.

## 📋 Table of Contents

- [🔐 Supported Versions](#-supported-versions)
- [🚨 Reporting a Vulnerability](#-reporting-a-vulnerability)
- [🛡️ Security Features](#️-security-features)
- [🔍 Security Practices](#-security-practices)
- [⚙️ Security Configuration](#️-security-configuration)
- [🤖 Automated Security](#-automated-security)
- [📚 Security Best Practices for Users](#-security-best-practices-for-users)
- [🏆 Security Hall of Fame](#-security-hall-of-fame)

---

## 🔐 Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 2.0.x   | ✅ Yes            | Active development |
| 1.x.x   | ⚠️ Limited        | Critical security fixes only |
| < 1.0   | ❌ No             | No longer supported |

**Current Stable Version:** v2.0.0 (Released: 2026-02-09)

### 🔄 Update Recommendations

- **Always use the latest version** for the best security and features
- **Subscribe to releases** on GitHub to get notified of security updates
- **Review CHANGELOG.md** before upgrading to understand breaking changes

---

## 🚨 Reporting a Vulnerability

**⚠️ IMPORTANT: Please DO NOT report security vulnerabilities through public GitHub issues!**

### 📧 How to Report

If you discover a security vulnerability, please email us privately:

**Email:** [Create a private security advisory on GitHub]

Or use GitHub's Security Advisory feature:
1. Go to the [Security tab](https://github.com/whiteravens20/exemplar/security)
2. Click "Report a vulnerability"
3. Fill in the details

### 📝 What to Include

Please provide as much information as possible:

- **Type of vulnerability** (e.g., SQL injection, XSS, authentication bypass)
- **Affected component(s)** (e.g., message handler, n8n client, rate limiter)
- **Steps to reproduce** - Clear, step-by-step instructions
- **Proof of concept** - Code or screenshots demonstrating the issue
- **Impact assessment** - What could an attacker achieve?
- **Suggested fix** - If you have ideas (optional)
- **Your environment**:
  - Node.js version
  - Discord.js version
  - Operating System
  - Deployment method (Docker, direct, etc.)

### ⏰ Response Timeline

We take all security reports seriously and will respond according to severity:

| Severity | Initial Response | Fix Timeline | Disclosure |
|----------|-----------------|--------------|------------|
| 🔴 Critical | Within 24 hours | 1-3 days | After fix is deployed |
| 🟠 High | Within 48 hours | 3-7 days | After fix is deployed |
| 🟡 Medium | Within 1 week | 1-2 weeks | After fix is deployed |
| 🟢 Low | Within 2 weeks | Next release | With release notes |

### 🎁 Recognition

We believe in recognizing security researchers who help us improve:

- **Public acknowledgment** in our Security Hall of Fame (with your permission)
- **Credit in release notes** for the security fix
- **Priority support** for future contributions
- Our eternal gratitude! 💚

---

## 🛡️ Security Features

### 🔒 DM-Only Mode (v2.0.0+)

**Privacy by Design:**
- Bot **only responds to Direct Messages** (DMs)
- All guild/channel messages are ignored (except hardcoded mention responses)
- Reduces attack surface and protects user privacy
- Prevents unauthorized access in compromised servers

### 🚦 Rate Limiting

**Built-in DDoS Protection:**
- **5 messages per minute** per user
- Prevents spam and abuse
- Automatic cleanup of expired limits
- Clear feedback to users when limits are hit

```javascript
// Rate limit implementation
const RATE_LIMIT_MESSAGES = 5;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
```

### 🔐 Environment Variable Security

**Sensitive Data Protection:**
- All secrets stored in `.env` file (never committed)
- `.env.example` template without real credentials
- Environment validation on startup
- Clear error messages without exposing sensitive data

**Protected Secrets:**
- `DISCORD_TOKEN` - Discord bot token
- `N8N_WEBHOOK_URL` - n8n webhook endpoint
- API keys and credentials

### 🛡️ Input Validation & Sanitization

**Message Processing:**
- Discord.js handles input sanitization
- Message content is validated before processing
- Rate limiting prevents message flooding
- Command permissions are enforced

### 📊 Secure Logging

**Privacy-Preserving Logs:**
- **Never log sensitive data** (tokens, passwords, full webhook URLs)
- User IDs are logged (not personal information)
- Error stacks exclude sensitive context
- Logs are stored locally (not transmitted)

**What we DON'T log:**
- Discord tokens
- n8n webhook URLs (logged as `[REDACTED]`)
- User message content in production
- API keys or credentials

---

## 🔍 Security Practices

### 🔐 Authentication & Authorization

**Discord Integration:**
- Bot token is securely stored in environment variables
- Token has minimum required permissions
- Role-based access control for bot features
- Admin commands require elevated permissions

**n8n Integration:**
- Webhook URL is treated as a secret
- HTTPS-only communication (recommended)
- Retry logic with exponential backoff prevents DoS
- Timeout protection (5 seconds default)

### 🔒 Dependency Security

**Keeping Dependencies Secure:**
- Node.js 22+ (latest LTS with security fixes)
- Discord.js 14.x (actively maintained)
- All dependencies regularly updated
- No known vulnerable dependencies

**Key Dependencies:**
- `discord.js`: ^14.25.1
- `axios`: ^1.13.5
- `winston`: ^3.19.0
- `dotenv`: ^17.2.4

### 🛡️ Code Security

**Secure Coding Practices:**
- ✅ Async/await error handling (no unhandled rejections)
- ✅ Input validation on all user inputs
- ✅ Proper error handling with user-friendly messages
- ✅ No eval() or dangerous dynamic code execution
- ✅ TypeScript-style JSDoc annotations for type safety

### 🐳 Docker Security

**Container Security:**
- Multi-stage builds to reduce image size
- Non-root user in production images
- Minimal base images (Alpine Linux)
- No unnecessary packages installed
- Trivy scanning in CI/CD pipeline

---

## ⚙️ Security Configuration

### 🔧 Environment Variables

**Required Security Settings:**

```bash
# Discord Bot Token (REQUIRED)
DISCORD_TOKEN=your_discord_bot_token_here

# Discord Client ID (REQUIRED)
DISCORD_CLIENT_ID=your_discord_client_id_here

# Discord Guild ID (REQUIRED)
DISCORD_GUILD_ID=your_discord_guild_id_here

# n8n Webhook URL (REQUIRED)
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-path

# Rate Limiting
RATE_LIMIT_MESSAGES=5        # Messages per window
RATE_LIMIT_WINDOW=60000      # Window in milliseconds (60s)

# Timeouts
N8N_REQUEST_TIMEOUT=5000     # n8n timeout (5s)
```

### 🔐 Discord Bot Permissions

**Minimum Required Permissions:**
- `ReadMessages` / `ViewChannel` - To read DMs
- `SendMessages` - To respond to users
- `EmbedLinks` - For rich message formatting (optional)

**NOT Required:**
- ❌ Administrator
- ❌ Manage Server
- ❌ Manage Channels
- ❌ Ban Members (reserved for future automated moderation)
- ❌ Kick Members (reserved for future automated moderation)

**Permission Setup:**
```
Bot Permissions Integer: 2048
OAuth2 URL: https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2048&scope=bot%20applications.commands
```

### 🛡️ Network Security

**Recommendations:**
- ✅ Use HTTPS for n8n webhooks
- ✅ Deploy behind reverse proxy (nginx, Caddy)
- ✅ Enable firewall rules (allow only necessary ports)
- ✅ Use VPC/private networks when possible
- ✅ Enable bot verification on Discord

---

## 🤖 Automated Security

We use multiple automated tools to catch security issues early:

### 🔍 CodeQL Analysis

**Static Application Security Testing (SAST):**
- Runs on every push and PR
- Scans for common vulnerabilities
- JavaScript/TypeScript security patterns
- Automated code review

**What it catches:**
- SQL injection attempts
- XSS vulnerabilities
- Path traversal
- Command injection
- Hardcoded secrets

### 🤖 Dependabot

**Automated Dependency Updates:**
- **Daily** security updates
- **Weekly** dependency updates
- Grouped updates by type
- Automatic PR creation

**Update Categories:**
- Security patches (immediate)
- Production dependencies (weekly)
- Development dependencies (weekly)

### 🛡️ npm audit

**Dependency Vulnerability Scanning:**
- Runs in CI/CD pipeline
- Checks npm advisory database
- Fails builds on high/critical vulnerabilities
- Automated fixes when possible

```bash
# Run manually
npm audit
npm audit fix
```

### 🐳 Trivy Scanning

**Docker Image Vulnerability Scanning:**
- Scans Docker images in CI/CD
- Checks for OS and package vulnerabilities
- Integrated into Docker workflow
- Fails on high/critical vulnerabilities

---

## 📚 Security Best Practices for Users

### 🔐 For Bot Administrators

**Token Management:**
- ✅ **Never share your Discord bot token**
- ✅ Rotate tokens if potentially compromised
- ✅ Use environment variables (never hardcode)
- ✅ Add `.env` to `.gitignore`
- ✅ Use separate tokens for dev/staging/production

**Deployment Security:**
- ✅ Keep Node.js updated (use v22+)
- ✅ Run bot as non-root user
- ✅ Use Docker with non-root user
- ✅ Enable firewall rules
- ✅ Monitor logs for suspicious activity
- ✅ Backup your `.env` file securely
- ✅ Use HTTPS for n8n webhooks

**Access Control:**
- ✅ Limit bot permissions to minimum required
- ✅ Use role-based access for bot features
- ✅ Regularly audit bot permissions
- ✅ Review Discord server member permissions

### 👥 For Contributors

**Code Security:**
- ✅ Never commit secrets or tokens
- ✅ Run `npm audit` before submitting PRs
- ✅ Follow secure coding practices
- ✅ Review code for security issues
- ✅ Test security features thoroughly
- ✅ Update dependencies responsibly

**See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed security guidelines.**

### 🚀 For End Users

**Using the Bot Safely:**
- ✅ Only interact with verified bots
- ✅ Use DMs for sensitive conversations
- ✅ Don't share personal information unnecessarily
- ✅ Report suspicious bot behavior
- ✅ Be aware of rate limits (5 msg/min)

---

## 🏆 Security Hall of Fame

We thank the following security researchers and contributors who have helped make this project more secure:

<!-- Add names here when vulnerabilities are reported and fixed -->

**Nobody has reported a vulnerability yet - be the first!** 🎯

---

## 📞 Contact

**Security Issues:** Report via GitHub Security Advisory or email maintainers privately  
**General Questions:** Open a [GitHub Discussion](https://github.com/whiteravens20/exemplar/discussions)  
**Project Issues:** [GitHub Issues](https://github.com/whiteravens20/exemplar/issues)

---

## 📄 Additional Resources

- 📖 [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines including security practices
- 📚 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Community standards
- 📋 [README.md](README.md) - Project overview and features
- 📝 [CHANGELOG.md](CHANGELOG.md) - Version history and security updates
- 🔧 [docs/SETUP.md](docs/SETUP.md) - Secure configuration guide
- 🐳 [docs/DOCKER_SETUP.md](docs/DOCKER_SETUP.md) - Docker security best practices

---

**Last Updated:** February 12, 2026  
**Version:** 1.0.0  
**Project Version:** 2.0.0

---

## 🌟 Stay Secure!

Remember: **Security is everyone's responsibility.** By following these guidelines and reporting issues responsibly, you help keep our community safe. Thank you! 🙏

**Report security issues → Get recognized → Help the community → Feel awesome!** 💪
