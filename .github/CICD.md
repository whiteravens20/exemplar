# CI/CD

## Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `test.yml` | Push to `main`/`dev`, any PR (skipped for docs-only changes) | Lint, tests, typecheck, build, required-file and env checks |
| `codeql.yml` | Push/PR to `main`/`dev` (skipped for docs-only changes); weekly | CodeQL analysis (`javascript-typescript`) |
| `security.yml` | Push or PR to `main`/`dev`; weekly; manual | Dependency audit and registry signature check, dependency review, Trivy scans of the repository and of the Docker image, checks of the pinned actions |
| `scorecard.yml` | Push to `dev`; weekly | OpenSSF Scorecard, published for the README badge |
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
| Required status checks | `test`, `Analyze Code (javascript-typescript)`, `npm audit`, `Trivy filesystem scan`, `Trivy Docker image scan` | The check names GitHub reports, not job IDs |
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

`release.yml` then publishes `ghcr.io/whiteravens20/exemplar` with the tags `X.Y.Z`, `X.Y`, `X`, `main` and `latest`, an alias of `main`, and creates the GitHub Release. The release body is the tag message plus notes generated from PR titles (grouped by `.github/release.yml`), with a source tarball attached. A tag that does not point at a commit on `main` is ignored.

The image scan, here and in `security.yml`, fails on unacknowledged HIGH/CRITICAL CVEs; acknowledge one by adding its ID with a justification to `.trivyignore`.

## Pinned actions

Every action a workflow uses is pinned to a commit SHA, with the version it stands for in a comment: `actions/checkout@<sha> # v7.0.1`. A tag can be moved by the action's publisher; a SHA cannot. Dependabot keeps the pins current by rewriting the SHA and the comment together: minor and patch updates arrive as one PR a month, a major on its own.

Two checks in `security.yml` run `.github/scripts/verify-pins.sh`. `Pinned actions` fails when a reference is not a SHA, has no version comment, or is not the commit its version tag points at. `Actions audit` asks GitHub's advisory database about every pinned version, because Dependabot raises no alert for an action pinned by SHA.

When adding an action, pin it the same way and run the script before pushing.

## Pinned base image

The `Dockerfile` pins its base image by version and digest: `node:22.23.3-alpine@sha256:…`. Docker pulls the image by the digest; the version beside it says what the digest is. Dependabot moves both when a new minor or patch of Node 22 is out, and the digest alone when the same version is rebuilt, each after the same seven days as any other update. A new major of Node is not proposed: it is changed by hand, together with `node-version` in the workflows.

## Dependency audit

The `npm audit` check runs `.github/scripts/audit-check.mjs` twice: production dependencies fail it from `moderate`, the whole tree from `high`. It then installs the packages and verifies their registry signatures with `npm audit signatures`.

`npm audit` cannot ignore a single advisory. When one has no installable fix and its code path cannot be reached here, add it to `.github/scripts/audit-allowlist.json` with a reason and an expiry date, and the same ID to `allow-ghsas` of the dependency review in `security.yml`:

```json
{ "ghsa": "GHSA-xxxx-xxxx-xxxx", "reason": "why it cannot be reached", "expires": "2026-12-31", "workspaces": ["."] }
```

An expired entry fails the check, so every exception comes back for review. If a fix can be installed, bump the dependency instead.

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
