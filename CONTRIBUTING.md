# 🎉 Contributing to Discord AI Assistant Bot

Hey there! 👋 Thanks for your interest in making this project even better! We're excited to have you here and can't wait to see what awesome contributions you'll bring to the table. 

Whether you're fixing a bug 🐛, adding a new feature ✨, improving documentation 📚, or just asking questions 💬 - all contributions are welcome and appreciated! 

## 📋 Table of Contents

- [🤝 Code of Conduct](#-code-of-conduct)
- [🐛 Reporting Bugs](#-reporting-bugs)
- [💡 Suggesting Features](#-suggesting-features)
- [🚀 Getting Started](#-getting-started)
- [💻 Development Workflow](#-development-workflow)
- [📝 Coding Standards](#-coding-standards)
- [✅ Testing Your Changes](#-testing-your-changes)
- [📚 Documentation](#-documentation)
- [🔒 Security Best Practices](#-security-best-practices)- ⚡ [Performance Tips](#-performance-tips)- [🎯 Pull Request Process](#-pull-request-process)
- [❓ Questions?](#-questions)

## 🤝 Code of Conduct

We're committed to providing a welcoming and inclusive environment for everyone! 🌈

Please read our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details on our community standards and how we expect everyone to behave.

**TL;DR:** Be kind, be respectful, be awesome! ❤️

## 🐛 Reporting Bugs

Found a bug? No worries - it happens! 🪲 Here's how to report it effectively:

### Before You Submit

1. 🔍 **Search existing issues** - Someone might have already reported it
2. 📖 **Check the docs** - Make sure it's actually a bug and not expected behavior
3. 🆕 **Use the latest version** - The bug might already be fixed in v2.0.0+

### Creating a Bug Report

When you're ready to report, create a new issue and include:

✅ **Clear title** - Something like "Rate limiter not working in DMs"  
✅ **Detailed description** - What went wrong?  
✅ **Reproduction steps** - How can we see the bug ourselves?  
✅ **Expected behavior** - What should have happened?  
✅ **Actual behavior** - What actually happened?  
✅ **Environment info**:
   - Node.js version (should be 22+)
   - Discord.js version
   - Operating System
✅ **Logs** - Attach relevant logs from `logs/combined.log` or `logs/error.log`  
✅ **Screenshots** - If applicable! 📸

**Pro tip:** The more details you provide, the faster we can fix it! ⚡

## 💡 Suggesting Features

Have an awesome idea? We'd love to hear it! 🌟

### Before You Suggest

1. 🔍 Check if someone already suggested it
2. 💭 Think about how it fits with the project's goals (DM-only bot, n8n integration, coding mode, etc.)
3. 🤔 Consider if it's something many users would benefit from

### Creating a Feature Request

Create a new issue or discussion with `[FEATURE]` in the title and include:

✨ **What** - What feature do you want?  
❓ **Why** - Why would it be useful?  
💡 **How** - Any ideas on implementation?  
📊 **Use cases** - Real-world scenarios where this helps  
🎨 **Examples** - Links to similar features elsewhere (if any)

## 🚀 Getting Started

Ready to code? Awesome! Let's get you set up. 🎮

### Prerequisites

- 📦 Node.js 22+ (LTS) - **Required as of v2.0.0!**
- 📦 npm 10+ or yarn
- 🤖 Discord Bot Token ([Get one here](https://discord.com/developers/applications))
- 🔄 n8n instance (for testing workflows)
- ☕ Your favorite beverage

### Initial Setup

```bash
# 1. Fork the repository on GitHub 🍴
# Click the "Fork" button on the repo page

# 2. Clone YOUR fork
git clone https://github.com/YOUR_USERNAME/exemplar.git
cd exemplar

# 3. Add upstream remote (to sync with main repo)
git remote add upstream https://github.com/whiteravens20/exemplar.git

# 4. Install dependencies 📦
npm install

# 5. Copy and configure environment variables
cp .env.example .env
# Edit .env with your test bot token and n8n details

# 6. Deploy slash commands to your test server
npm run deploy-commands

# 7. Start in development mode with auto-reload 🔥
npm run dev
```

### 🎯 Important: Project Architecture (v2.0.0+)

Before you start coding, understand these key architectural decisions:

🔒 **DM-Only Mode** - The bot exclusively operates in Direct Messages (privacy-first design)  
💻 **Dual AI Modes** - `!code` prefix routes to specialized coding LLM, default is chat mode  
🚦 **Rate Limiting** - Built-in protection: 5 messages/minute per user  
✂️ **Smart Message Splitting** - Automatically handles Discord's 2000 character limit  
🔄 **n8n Integration** - All AI responses go through n8n workflows  
📦 **Node.js 22+** - We use the latest LTS features!

## 💻 Development Workflow

### 🌿 Branching Strategy

```bash
# Always start from an up-to-date main branch
git checkout main
git pull upstream main

# Create a feature branch with a descriptive name
git checkout -b feature/awesome-new-feature
# or
git checkout -b fix/annoying-bug
```

### 🎨 Making Changes

1. 💡 **Make your changes** - Code away!
2. 🧪 **Test locally** - Make sure it works
3. 📝 **Update docs** - If needed
4. ✅ **Commit often** - Small, atomic commits are your friend!

### 📦 Committing Changes

We use **conventional commits** - they help generate changelogs automatically! 🎉

**Format:** `type: brief description`

**Types:**
- ✨ `feat` - New feature (e.g., `feat: add user statistics command`)
- 🐛 `fix` - Bug fix (e.g., `fix: resolve rate limiter memory leak`)
- 📚 `docs` - Documentation only (e.g., `docs: update contributing guide`)
- ♻️ `refactor` - Code change that neither fixes a bug nor adds a feature
- ✅ `test` - Adding or updating tests
- ⚡ `perf` - Performance improvement
- 🔧 `chore` - Maintenance tasks (e.g., `chore: update dependencies`)
- 🔒 `security` - Security improvements

**Examples:**
```bash
git commit -m "feat: add support for voice channel monitoring"
git commit -m "fix: correct DM detection logic"
git commit -m "docs: add examples for coding mode usage"
git commit -m "refactor: simplify error handler code"
```

## 📝 Coding Standards

Let's keep the code clean and consistent! ✨

### 🏗️ File Structure

```javascript
// 1. Imports (grouped logically)
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

// 2. Local imports
const logger = require('../utils/logger');
const config = require('../config/config');

// 3. Constants
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

// 4. Main code
async function doSomething() {
  // Implementation here
}

// 5. Exports
module.exports = { doSomething };
```

### 🏷️ Naming Conventions

- 🐫 `camelCase` for variables and functions: `userId`, `handleMessage()`
- 🐫 `PascalCase` for classes: `MessageHandler`, `RateLimiter`
- 🔤 `UPPER_SNAKE_CASE` for constants: `MAX_MESSAGE_LENGTH`, `API_TIMEOUT`
- 📝 Use descriptive names: `userMessage` not `msg`, `retryCount` not `x`

**Examples:**
```javascript
// ✅ Good
const messageContent = interaction.content;
const MAX_RETRY_ATTEMPTS = 3;
class ErrorHandler { }

// ❌ Avoid
const mc = interaction.content;
const max = 3;
class errorhandler { }
```

### 📊 Logging

We use Winston for logging - it's your best friend for debugging! 🔍

```javascript
const logger = require('../utils/logger');

// 📘 Info - Normal operations
logger.info('Message received from user', { 
  userId: message.author.id,
  mode: isCodeMode ? 'code' : 'chat' 
});

// ⚠️ Warning - Something unexpected but not broken
logger.warn('Rate limit approaching', { 
  userId: user.id, 
  messageCount: count 
});

// 🚨 Error - Something went wrong
logger.error('Failed to send to n8n', { 
  error: error.message,
  stack: error.stack,
  url: webhookUrl
});
```

**Pro tip:** Always include context! It makes debugging so much easier. 🎯

### 🛡️ Error Handling

Always handle errors gracefully - users should never see raw error stacks! 🙈

```javascript
try {
  await riskyOperation();
} catch (error) {
  // Log the full error for debugging
  logger.error('Operation failed', { 
    error: error.message,
    stack: error.stack,
    context: { userId, action }
  });
  
  // Show user-friendly message
  await interaction.reply({
    content: '❌ Oops! Something went wrong. Please try again later.',
    ephemeral: true
  });
}
```

### 💬 Comments

Write comments that explain **WHY**, not **WHAT** - the code should be self-explanatory! 💡

```javascript
// ❌ Bad - Explains what (obvious from code)
// Check if user is admin
if (member.permissions.has('ADMINISTRATOR')) {

// ✅ Good - Explains why (business logic)
// Only admins can bypass rate limiting for urgent announcements
if (member.permissions.has('ADMINISTRATOR')) {

// ✅ Good - Complex logic explanation
// Use exponential backoff: 1s, 2s, 4s for retries
// This prevents overwhelming the n8n server during outages
const delay = Math.pow(2, attempt) * 1000;
```

## 🔨 Creating New Features

### 🎮 Adding a Slash Command

Want to add a new slash command? Here's the template! 🚀

```javascript
// src/slashcommands/mycommand.js
const { SlashCommandBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mycommand')
    .setDescription('🎉 Description of your awesome command')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Some helpful text input')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('An optional number')
        .setRequired(false)
    ),
  
  async execute(interaction) {
    try {
      // Get options
      const text = interaction.options.getString('text');
      const amount = interaction.options.getInteger('amount') || 1;
      
      // Log the command usage
      logger.info('Command executed', {
        command: 'mycommand',
        userId: interaction.user.id,
        guildId: interaction.guild?.id
      });
      
      // Do something awesome
      const result = await doSomethingCool(text, amount);
      
      // Reply to user
      await interaction.reply({
        content: `✨ ${result}`,
        ephemeral: false // Set to true for private replies
      });
      
    } catch (error) {
      logger.error('Command execution failed', {
        command: 'mycommand',
        error: error.message,
        stack: error.stack
      });
      
      await interaction.reply({
        content: '❌ Oops! Something went wrong. Please try again.',
        ephemeral: true
      });
    }
  }
};
```

**Don't forget:** Run `npm run deploy-commands` after adding new commands! 🔄

### 🎯 Adding an Event Handler

Events are what make the bot react to Discord actions! ⚡

```javascript
// src/events/myevent.js
const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageCreate, // or Events.GuildMemberAdd, etc.
  once: false, // Set to true for events that should only fire once
  
  async execute(message) {
    try {
      // Your event handling logic here
      logger.info('Event triggered', {
        event: 'MessageCreate',
        userId: message.author.id
      });
      
      // Do something with the event
      await handleMessage(message);
      
    } catch (error) {
      logger.error('Event handler error', {
        event: 'MessageCreate',
        error: error.message
      });
    }
  }
};
```

### 🔧 Adding a Utility Function

Creating a reusable utility? Put it in `/src/utils/`! 🛠️

```javascript
// src/utils/my-helper.js
const logger = require('./logger');

/**
 * 📝 Description of what this utility does
 * @param {string} input - What this parameter is for
 * @param {object} options - Optional configuration
 * @returns {Promise<string>} What this returns
 */
async function myHelper(input, options = {}) {
  try {
    // Your helper logic
    const result = processInput(input, options);
    return result;
  } catch (error) {
    logger.error('Helper function error', { error: error.message });
    throw error; // Re-throw for caller to handle
  }
}

module.exports = { myHelper };
```

## ✅ Testing Your Changes

Testing is super important! 🧪 Here's how to make sure your code works:

### 🏃 Manual Testing

```bash
# 1. Test your configuration
npm run test-config

# 2. Deploy commands (if you added/modified slash commands)
npm run deploy-commands

# 3. Start the bot in dev mode
npm run dev

# 4. Test in Discord!
# - Create a test server
# - Add your bot
# - Try all the features you changed
# - Test error cases too!
```

### 🎯 Testing Checklist

Before submitting your PR, make sure you've tested:

- ✅ **Happy path** - Does it work when everything goes right?
- ✅ **Error handling** - What happens when things go wrong?
- ✅ **Edge cases** - Empty inputs? Very long inputs? Special characters?
- ✅ **Rate limiting** - Does it respect the 5 messages/minute limit?
- ✅ **DM-only mode** - Does it work in DMs? Does it ignore guild messages?
- ✅ **Coding mode** - If relevant, test with `!code` prefix
- ✅ **Logs** - Check that appropriate logs are generated

### 🧪 Automated Tests

We have Jest tests for critical utilities:

```bash
# Run all tests
npm test

# Run tests in watch mode (useful during development)
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

If you're adding new utility functions (especially in `/src/utils/`), please add tests! 🎯

```javascript
// tests/my-helper.test.js
const { myHelper } = require('../src/utils/my-helper');

describe('myHelper', () => {
  test('should handle valid input', async () => {
    const result = await myHelper('test input');
    expect(result).toBe('expected output');
  });
  
  test('should throw error on invalid input', async () => {
    await expect(myHelper('')).rejects.toThrow();
  });
});
```

## 📚 Documentation

Good documentation is just as important as good code! 📖

### 📝 When to Update Documentation

Update the docs when you:

- ✨ Add a new feature → Update `README.md` and relevant guides
- 🐛 Fix a bug → Update `CHANGELOG.md`
- 🔧 Change configuration → Update `SETUP.md` and `.env.example`
- 🏗️ Modify project structure → Update `PROJECT_STRUCTURE.md`
- 🎯 Add new commands → Update usage documentation
- ⚙️ Change environment variables → Update `.env.example` with comments

### 📋 Documentation Checklist

Before submitting your PR:

- [ ] 📘 Updated `README.md` if user-facing changes
- [ ] 📝 Updated relevant doc files in `/docs/`
- [ ] 💬 Added/updated inline code comments
- [ ] 🔧 Updated `.env.example` for new variables
- [ ] 📊 Updated `CHANGELOG.md` (follow Keep a Changelog format)
- [ ] 🏗️ Updated `PROJECT_STRUCTURE.md` if you added new files

### ✍️ Writing Style

Keep docs friendly and clear! 🌟

- ✅ Use emojis to make it more engaging (like this guide!)
- ✅ Write in clear, simple language
- ✅ Include code examples
- ✅ Add step-by-step instructions
- ✅ Use **bold** for important points
- ✅ Use links to related sections
- ❌ Avoid jargon without explanation
- ❌ Don't assume prior knowledge

## 🔒 Security Best Practices

Security is serious business! 🛡️ Here's how to keep the project safe:

### 🚫 Never Commit Secrets

**NEVER EVER** commit these to the repository:

- 🔑 Discord bot tokens
- 🔐 API keys
- 🗝️ Webhook URLs
- 💾 Database credentials
- 🔒 Any sensitive data

**Use `.env` for secrets!** The `.env` file is in `.gitignore` for a reason. ☝️

### ✅ Security Checklist

- [ ] 🔍 Review your changes for exposed secrets before committing
- [ ] 🛡️ Validate and sanitize all user inputs
- [ ] 🔐 Use permission checks for sensitive operations
- [ ] 📊 Log security-relevant events
- [ ] ⚡ Keep dependencies up to date
- [ ] 🔒 Use environment variables for configuration

### 🔧 Security Commands

```bash
# Check for known vulnerabilities
npm audit

# Fix vulnerabilities automatically (when possible)
npm audit fix

# Check for outdated packages
npm outdated

# Update dependencies
npm update
```

**Pro tip:** Dependabot is configured to automatically create PRs for security updates! 🤖

### 🚨 Found a Security Issue?

If you discover a security vulnerability, **DO NOT** open a public issue! 

Instead:
1. 📧 Email the maintainers privately
2. 🔒 Include details and reproduction steps
3. ⏰ Give us reasonable time to fix it
4. 🎉 We'll credit you in the fix announcement (if you want)

**See our [SECURITY.md](SECURITY.md) for full details on responsible disclosure.**

## ⚡ Performance Tips

Keep the bot fast and responsive! 🚀

### Do's ✅

- ✅ Use `async/await` for asynchronous operations
- ✅ Cache frequently accessed data
- ✅ Use connection pooling
- ✅ Monitor logs for slow operations
- ✅ Implement rate limiting (already built-in!)
- ✅ Use efficient data structures

### Don'ts ❌

- ❌ Don't use blocking operations
- ❌ Avoid unnecessary API calls
- ❌ Don't load large data sets into memory unnecessarily
- ❌ Avoid nested loops when possible
- ❌ Don't ignore memory leaks

```javascript
// ✅ Good - Non-blocking, efficient
async function processMessages(messages) {
  return Promise.all(messages.map(msg => processMessage(msg)));
}

// ❌ Bad - Blocking, inefficient
function processMessages(messages) {
  let results = [];
  for (let msg of messages) {
    results.push(processMessageSync(msg)); // Blocks on each iteration
  }
  return results;
}
```

## 🎯 Pull Request Process

Ready to submit your contribution? Here's what happens next! 🎊

### 1️⃣ Before Submitting

Make sure you've:

- ✅ Tested your changes thoroughly
- ✅ Updated relevant documentation
- ✅ Followed the coding standards
- ✅ Written clear commit messages
- ✅ Synced with the latest main branch

```bash
# Sync with upstream
git checkout main
git pull upstream main
git checkout your-feature-branch
git rebase main
```

### 2️⃣ Creating the PR

1. 🚀 Push your branch to your fork
   ```bash
   git push origin feature/your-awesome-feature
   ```

2. 🌐 Go to GitHub and create a Pull Request

3. 📝 Fill out the PR template:
   - **Title**: Use conventional commit format (e.g., `feat: add user stats command`)
   - **Description**: Explain what and why
   - **Related issues**: Link any related issues (#123)
   - **Screenshots**: If UI changes, include before/after
   - **Testing**: Describe how you tested it

### 3️⃣ PR Review Process

Here's what happens after you submit:

1. 🤖 **Automated Checks** - CI runs tests, linting, security scans
   - ✅ All checks must pass
   - 🔍 CodeQL analysis
   - 🛡️ npm audit
   - ✅ Jest tests

2. 👀 **Code Review** - A maintainer reviews your code
   - We aim to review within 48 hours
   - We may request changes
   - Don't take it personally - we're all learning! 💚

3. 🔄 **Iterations** - Make requested changes
   - Push new commits to the same branch
   - The PR updates automatically
   - Respond to comments

4. ✅ **Approval** - Once approved:
   - PR is merged to main
   - Changes are included in next release
   - You're credited in CHANGELOG! 🎉

5. 🎊 **Celebrate** - You're now a contributor! 🙌

### 📋 PR Best Practices

- 🎯 **Keep PRs focused** - One feature/fix per PR
- 📏 **Keep PRs small** - Easier to review (aim for <500 lines)
- 💬 **Be responsive** - Reply to review comments promptly
- 🤝 **Be open to feedback** - Reviews help everyone improve
- 📸 **Add screenshots** - Visual changes need visuals!
- ✅ **Check the checklist** - Complete the PR template fully

## ❓ Questions?

Stuck? Need help? We're here for you! 🤗

### 💬 Where to Ask

- **💡 General questions** → [GitHub Discussions](https://github.com/whiteravens20/exemplar/discussions)
- **🐛 Bug reports** → [GitHub Issues](https://github.com/whiteravens20/exemplar/issues)
- **📚 Documentation** → Check `/docs` folder
- **💻 Code examples** → Look at existing code in the repo

### 📖 Helpful Resources

- 📘 [README.md](README.md) - Project overview- 🔒 [SECURITY.md](SECURITY.md) - Security policy and reporting- 🚀 [QUICKSTART.md](docs/QUICKSTART.md) - Get started fast
- 🔧 [SETUP.md](docs/SETUP.md) - Detailed setup guide
- 🏗️ [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) - Code organization
- ❓ [FAQ.md](docs/FAQ.md) - Common questions
- 🔄 [N8N_INTEGRATION.md](docs/N8N_INTEGRATION.md) - Workflow integration
- 🐳 [DOCKER_SETUP.md](docs/DOCKER_SETUP.md) - Docker deployment

### 🌟 Pro Tips

- 🔍 Search closed issues - your question might be answered already
- 📝 Read the existing code - it's a great learning resource
- 🧪 Experiment in a test server - break things safely!
- 💡 Start small - fix typos, improve docs, then move to code
- 🤝 Help others - answer questions in discussions

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](LICENSE).

This means:
- ✅ Your code can be used freely
- ✅ You retain copyright
- ✅ You grant permissions to use, modify, and distribute
- ✅ You provide code "as-is" without warranty

---

## 🎉 Thank You!

**Thank you so much for contributing!** 💖

Every contribution, no matter how small, makes this project better. Whether you're fixing a typo, reporting a bug, or adding a major feature - you're awesome! 🌟

We're excited to see what you'll build! 🚀

**Happy coding!** 💻✨

---

### 🏆 Recognition

Contributors are recognized in:
- 📝 CHANGELOG.md for their contributions
- 🌟 GitHub contributors page
- 💚 Our eternal gratitude

Want to see your name here? Make your first contribution today! 🎯
