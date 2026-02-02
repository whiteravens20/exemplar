# Contributing to Discord AI Assistant Bot

Thanks for your interest in contributing to this project! Below you'll find guidelines.

## Code of Conduct

- Be respectful to others
- Don't publish sensitive data
- Report bugs constructively

## How to Report a Bug?

1. Check if bug is not already reported in Issues
2. Create new Issue with:
   - Clear title
   - Detailed description
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Logs from `combined.log` or `error.log`

## How to Propose a Feature?

1. Create Discussion or Issue with `[FEATURE]` in title
2. Describe:
   - What you want to achieve
   - Why it will be useful
   - Possible implementation

## Development Setup

```bash
# Fork repo
git clone https://github.com/YOUR_USERNAME/exemplar.git
cd exemplar

# Install dependencies
npm install

# Create .env from template
cp .env.example .env
# Edit .env with test values

# Run in dev mode with auto-reload
npm run dev
```

## Coding Standards

### Structure

```javascript
// 1. Imports
const { Discord, API } = require('discord.js');

// 2. Constants
const TIMEOUT = 5000;

// 3. Main code
async function doSomething() {
  // ...
}

// 4. Exports
module.exports = { doSomething };
```

### Naming

- `camelCase` for variables and functions
- `PascalCase` for classes
- `UPPER_CASE` for constants
- Descriptive names (not `x`, `y`, `temp`)

### Logging

```javascript
const logger = require('../utils/logger');

// Info
logger.info('Operation started', { userId, action });

// Warning
logger.warn('Unusual behavior', { data });

// Error
logger.error('Operation failed', { error: error.message });
```

### Error Handling

```javascript
try {
  await doSomething();
} catch (error) {
  logger.error('Error in doSomething', { 
    error: error.message,
    stack: error.stack
  });
  // Handle gracefully
}
```

### Comments

```javascript
// Use comments for WHY, not WHAT
// ❌ Bad: Add 5 to x
x += 5;

// ✅ Good: Pad response to minimum length
response += ' '.repeat(5);
```

## Creating Commands

### Slash Command

```javascript
// src/slashcommands/mycommand.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mycommand')
    .setDescription('Description of command')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Some text')
        .setRequired(true)
    ),
  
  async execute(interaction) {
    try {
      const text = interaction.options.getString('text');
      await interaction.reply(`You said: ${text}`);
    } catch (error) {
      logger.error('Command error', { error: error.message });
      await interaction.reply({
        content: '❌ Error executing command',
        ephemeral: true
      });
    }
  }
};
```

### Event Handler

```javascript
// src/events/myevent.js
const { Events } = require('discord.js');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Handle event
  }
};
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make commits (atomic, descriptive)
git add .
git commit -m "feat: add new command /test"

# Push
git push origin feature/your-feature-name

# Create Pull Request on GitHub
```

### Commit Messages

Format: `type: brief description`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code restructuring
- `test` - Tests
- `perf` - Performance
- `chore` - Maintenance

Examples:
```
feat: add role-based access control
fix: resolve n8n timeout issue
docs: update setup guide
refactor: improve error handling
```

## Testing

```bash
# Test configuration
npm run test-config

# Deploy commands (if changed)
npm run deploy-commands

# Manual testing in Discord
# Use test server/channel
```

## Documentation

When adding features, update:
- [ ] `README.md` - User facing
- [ ] `PROJECT_STRUCTURE.md` - Developer guide
- [ ] Inline code comments
- [ ] `.env.example` - New variables
- [ ] Relevant markdown files

## Performance

- Use `async/await` not callbacks
- Avoid blocking operations
- Cache frequently accessed data
- Monitor logs for slow operations

## Security

- Never log sensitive data (tokens, APIs)
- Validate user input
- Use permission checks
- Keep dependencies updated

Check with:
```bash
npm audit
npm outdated
```

## Review Process

1. Automated checks (linting, etc)
2. Code review by maintainers
3. Testing in staging environment
4. Merge to main branch
5. Deploy to production

## Questions?

- Create a Discussion on GitHub
- Check existing Issues
- Read the docs in `/docs`
- Look at examples in codebase

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing! 🎉**
