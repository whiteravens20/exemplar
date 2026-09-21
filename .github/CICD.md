# CI/CD

## Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `test.yml` | Push to `main`/`dev`, any PR (skipped for docs-only changes) | Lint, tests, `npm audit`, typecheck, build, required-file and env checks |
| `codeql.yml` | Push/PR to `main`/`dev` (skipped for docs-only changes); weekly | CodeQL analysis (`javascript-typescript`) |
| `security.yml` | PR to `main`/`dev`; push to `main`/`dev` touching `package*.json`; weekly | `npm audit`, dependency review, Trivy filesystem scan |
| `dependabot-auto-merge.yml` | Dependabot PRs | Auto-merges patch updates once required checks pass; labels major updates |
| `release.yml` | Push of a `vX.Y.Z` tag | Verifies the tag is on `main`, builds and pushes the Docker image to GHCR, scans it with Trivy, creates the GitHub Release |
| `branch-protection-audit.yml` | Daily; manual | Fails if `main` branch protection drifts from the profile below |

## Branch model

`dev` is the default branch and the target of every PR. `main` holds released code and only moves through a release PR from `dev`, merged with a **merge commit**: squashing or rebasing would rewrite the SHAs and permanently diverge `main` from `dev`.

## Branch protection on `main`

`branch-protection-audit.yml` enforces this profile. On a solo-maintainer repo the merge gate is CI, not a reviewer:

| Setting | Value | Why |
|---|---|---|
| Include administrators (`enforce_admins`) | On | The rules bind the maintainer too |
| Required approving reviews | 0 | Nobody can approve their own PR, so a review requirement would make `main` unmergeable |
| Require review from Code Owners | Off | Same reason |
| Require linear history | Off | Release PRs land as merge commits |
| Require signed commits | On | Every commit on `main` carries a verified signature |
| Require branches to be up to date | On | No stale-branch merges that skip CI |
| Required status checks | `test`, `Analyze Code (javascript-typescript)`, `npm audit`, `Trivy filesystem scan` | The check names GitHub reports, not job IDs |
| Force pushes, deletions | Blocked | Preserves history |

To read the full protection config, the audit needs a fine-grained PAT with `Administration: read` on this repo, stored as the `BRANCH_PROTECTION_READ_TOKEN` secret. Otherwise it falls back to `GITHUB_TOKEN`, which cannot see everything, and fails.

## Creating a release

1. On `dev`, bump the version: `npm version X.Y.Z --no-git-tag-version`, then commit `chore: bump version to X.Y.Z`.
2. Open a PR from `dev` to `main` titled `release: sync dev into main (vX.Y.Z)`, summarising what is promoted. Merge it with a merge commit once CI is green.
3. Tag the merge commit on `main` with a signed, annotated tag and push it:

   ```bash
   git switch main && git pull
   git tag -s vX.Y.Z -m "<release summary>"
   git push origin vX.Y.Z
   ```

`release.yml` then publishes `ghcr.io/whiteravens20/exemplar` with the tags `X.Y.Z`, `X.Y`, `X` and `main`, and creates the GitHub Release. The release body is the tag message plus notes generated from PR titles (grouped by `.github/release.yml`), with a source tarball attached. A tag that does not point at a commit on `main` is ignored.

The image scan fails on unacknowledged HIGH/CRITICAL CVEs; acknowledge one by adding its ID with a justification to `.trivyignore`.

## Dependency policy

A new version has to be public for 7 days before it can land:

- **Dependabot** runs with `cooldown: default-days: 7` for npm, GitHub Actions and Docker, targeting `dev`. Security updates are exempt and open immediately.
- **`.npmrc`** sets `min-release-age=7` and `ignore-scripts=true`. `min-release-age` only applies when npm resolves versions (`npm install`, `npm update`), not to `npm ci`, which installs what the lockfile pins.
- **Patch updates** from Dependabot auto-merge once the required checks pass.

If a trusted dependency needs its lifecycle scripts, rebuild it explicitly:

```bash
npm ci --ignore-scripts
npm rebuild esbuild   # only for packages you trust
```

To take a same-day fix for a CVE, override the release age for that one command only; never lower it in `.npmrc`:

```bash
npm install <pkg>@<version> --min-release-age=0
```

## Running the checks locally

```bash
npm ci
npm run lint
npm test
npm run typecheck
npm run build
```
