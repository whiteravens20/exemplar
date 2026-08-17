## Description
A clear and concise description of the changes made.

## Type of Change
Please check the relevant options:
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring
- [ ] Security fix

## Related Issue
Closes #(issue number)
Relates to #(issue number)

## How Has This Been Tested?
Describe the tests you ran to verify your changes:
- [ ] Unit tests (`npm test`)
- [ ] Manual testing
- [ ] Testing with the bot on a test server
- [ ] Docker image builds (`docker build .`)

## Database Migrations
- [ ] No migration needed
- [ ] Adds a migration in `migrations/`, applies cleanly with `npm run migrate:up`
- [ ] Rollback verified with `npm run migrate:down`

## Checklist
Please review the [Contributing Guidelines](../CONTRIBUTING.md) before submitting.

- [ ] My code follows the style guidelines of this project
- [ ] Commits follow Conventional Commits, one topic per commit
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## Security Checklist

- [ ] No secrets, tokens, or webhook URLs are committed (`.env.example` is sanitised)
- [ ] No new unvalidated environment variable is introduced; any new one is documented in `.env.example`
- [ ] `npm audit` shows no new high/critical findings
- [ ] ESLint passes with zero warnings
- [ ] TypeScript compiles with zero errors

## Screenshots (if applicable)
Add screenshots showing the changes in action.

## Additional Information
Any additional information that may be helpful during review.
