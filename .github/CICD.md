# CI/CD

## Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `test.yml` | Push/PR to `main`, `dev` | Lint, typecheck, build, tests, npm audit, file-presence checks |
| `security.yml` | Push/PR to `main`, `dev`; weekly | npm audit, dependency review, Trivy filesystem scan |
| `codeql.yml` | Push/PR to `main`, `dev`; weekly | CodeQL static analysis (javascript-typescript) |
| `quarantine-label.yml` | PR; daily | Labels Dependabot PRs that violate `.npmrc`'s 7-day quarantine |
| `dependabot-auto-merge.yml` | PR | Auto-squash patch updates; flag minor/major for review |
| `release.yml` | Push to `main` | Cuts a tag from `package.json` version, publishes a Docker image, scans with Trivy |
| `branch-protection-audit.yml` | Daily | Asserts `main` branch protection has not drifted |

All PRs to `main` and `dev` require all `test.yml` jobs and CodeQL to pass.

## Branch Protection Rules

Go to **Settings → Branches → Add rule** for `main` (repeat for `dev`):

| Setting | Value | Why |
|---|---|---|
| Require a pull request before merging | ✅ Enabled | No direct pushes to main |
| Require status checks to pass | `test`, `Analyze Code` | All test.yml + codeql.yml jobs must be green |
| Require branches to be up to date | ✅ Enabled | Prevents stale-branch merges that skip CI |
| Require review from Code Owners | ✅ Enabled | Enforces `.github/CODEOWNERS` sign-off |
| Required approving review count | 1 | Solo maintainer self-review is acceptable but a second approval is preferred |
| Require signed commits | ✅ Enabled | Every commit on `main` must carry a verified signature |
| Block force pushes | ✅ Enabled | Preserves audit trail |
| Block branch deletions | ✅ Enabled | Preserves audit trail |

## Creating a Release

```bash
# Bump the version in package.json, then push to main:
npm version patch --no-git-tag-version
git commit -am "chore: bump version to vX.Y.Z"
git push origin main
```

`release.yml` reads `package.json`, creates the matching `vX.Y.Z` tag if it does
not exist, builds the production Docker image, pushes it to GHCR, and scans with
Trivy. Releases happen automatically on every push to `main` — no manual tag
required.

## Required GitHub Repository Configuration

The only secret the workflows use is `GITHUB_TOKEN`, which GitHub provides
automatically — no manual configuration needed.

For the `branch-protection-audit.yml` workflow to read the full protection
config, create a fine-grained PAT with `Administration: read` on this repo only
and store it as the `BRANCH_PROTECTION_READ_TOKEN` repo secret. Without it the
job falls back to `GITHUB_TOKEN` and may report partial data.

## Supply-Chain Hardening

The root `.npmrc` enforces two defences:

| Setting | Value | Effect |
|---|---|---|
| `ignore-scripts` | `true` | Blocks `postinstall` / `preinstall` scripts from dependencies. Prevents malicious packages from executing code at install time (e.g. the axios 1.14.1 incident). |
| `min-release-age` | `7` | Refuses to resolve any package version published less than 7 days ago. Most supply-chain attacks are detected within hours; a 7-day quarantine window eliminates the majority of risk. |

These settings apply everywhere:

- **CI workflows** (`test.yml`, `codeql.yml`, `security.yml`) — `npm ci --ignore-scripts`
- **Dockerfile** — `npm ci --ignore-scripts`

If a trusted dependency genuinely requires lifecycle scripts (e.g. `esbuild`),
rebuild it explicitly after install:

```bash
npm ci --ignore-scripts
npm rebuild esbuild   # only for packages you trust
```

If you need to bypass the 7-day quarantine for a single command (e.g. when
patching a same-day CVE in a top-level dep), use the `--min-release-age=0`
override on a per-command basis only:

```bash
npm install axios@latest --min-release-age=0
```

Never lower the value in `.npmrc` permanently.
