# GitHub Actions & CI/CD Pipeline

This project includes a complete automated CI/CD pipeline using GitHub Actions. It handles testing, releases, and Docker image builds automatically.

## 📋 Workflow Overview

### 1. Test Workflow (`.github/workflows/test.yml`)

Runs on:
- Every push to `main` and `develop` branches
- Every pull request to `main` and `develop` branches
- Manual trigger via GitHub Actions

**What it does:**
- ✅ Tests Node.js 22.x compatibility
- ✅ Installs dependencies
- ✅ Runs linting (if available)
- ✅ Runs unit tests (if available)
- ✅ Tests bot configuration
- ✅ Checks JavaScript syntax in all source files
- ✅ Verifies required files exist
- ✅ Validates environment variables
- ✅ Checks Node.js version requirement (22+)
- ✅ Validates package.json integrity

**View results:**
```
Repository → Actions → Test → Select workflow run
```

### 2. Release Workflow (`.github/workflows/release.yml`)

Runs on:
- Push to `main` branch (only if changes to code, not docs)
- Automatically triggered after all tests pass

**What it does:**
1. **Runs full test suite** before creating release
2. **Gets version** from `package.json`
3. **Generates changelog** from commits since last release
4. **Creates GitHub Release** with:
   - Tag: `v{version}` (e.g., `v1.0.0`)
   - Title: `Release v{version}`
   - Changelog with recent commits
   - Installation instructions for Docker

**To trigger a new release:**
```bash
# 1. Update version in package.json
"version": "1.0.1"

# 2. Commit and push to main
git add package.json
git commit -m "Bump version to 1.0.1"
git push origin main

# 3. Workflow automatically creates release
```

**View releases:**
```
Repository → Releases
```

### 3. Docker Build Workflow (`.github/workflows/docker.yml`)

Runs on:
- New release published
- Changes to `Dockerfile`, `package.json`, or `src/` directory
- Manual trigger via GitHub Actions

**What it does:**
1. **Runs full test suite** before building image
2. **Builds Docker image** with multi-stage optimization
3. **Pushes to GitHub Container Registry** (`ghcr.io`)
4. **Creates tags:**
   - `latest` (for main branch)
   - `v1.0.0` (semantic versioning)
   - `1.0` (major.minor)
   - `1` (major version)
   - `main-sha123456` (commit hash)
5. **Scans image** for vulnerabilities (Trivy)
6. **Uploads security scan** results to GitHub Security tab

**Available images:**
```bash
# Latest version
docker pull ghcr.io/{owner}/{repo}:latest

# Specific release
docker pull ghcr.io/{owner}/{repo}:v1.0.0

# Major version
docker pull ghcr.io/{owner}/{repo}:1
```

## 🔧 Configuration

### Prerequisites

All workflows require:
- ✅ Node.js 22+
- ✅ npm 10+
- ✅ Valid `package.json`
- ✅ `.env.example` file with required variables
- ✅ Dockerfile (for Docker workflow)

### Permissions

Workflows use GitHub's built-in `GITHUB_TOKEN` with automatic permissions:
- `contents: read` - Read repository files
- `packages: write` - Push to GitHub Container Registry

No additional secrets needed!

### Manual Workflow Triggers

Go to: `Repository → Actions → Select Workflow → Run workflow`

## 📦 Release Package Creation

Manual script to create release archives (included in CI/CD):

```bash
npm run release-package
```

**Creates:**
- `dist/discord-ai-bot-v1.0.0.zip`
- `dist/discord-ai-bot-v1.0.0.tar.gz`
- `dist/checksums.txt`

**Contents:**
- `src/` - Application source code
- `node_modules/` - Production dependencies
- `Dockerfile` - Docker configuration
- `docker-compose.yml` - Compose configuration
- `.env.example` - Environment template
- `README.md` - Documentation
- `LICENSE` - License file

## 🧪 Testing

### Local Testing

Run the same tests as CI:

```bash
# Full test suite
npm test

# Just configuration test
npm run test-config

# Start bot
npm start

# Development mode (auto-reload)
npm run dev
```

### Test Coverage

The test workflow checks:

```
✅ Dependencies (discord.js, dotenv, axios, winston)
✅ File structure (all required directories)
✅ JavaScript syntax (all .js files)
✅ Configuration files (.env.example)
✅ Node.js version (22+)
✅ npm version (10+)
✅ package.json validity
✅ npm scripts exist
✅ Documentation files
```

## 🐳 Docker Integration

### From GitHub Container Registry

```bash
docker pull ghcr.io/whiteravens20/exemplar:latest
docker run -d --env-file .env ghcr.io/whiteravens20/exemplar:latest
```

### From docker-compose.yml

```yaml
version: '3.8'
services:
  discord-bot:
    image: ghcr.io/whiteravens20/exemplar:latest
    restart: unless-stopped
    env_file:
      - .env
```

## 📊 Workflow Status

Check workflow status and logs:

**Badge for README:**
```markdown
![Tests](https://github.com/{owner}/{repo}/actions/workflows/test.yml/badge.svg)
![Build Docker](https://github.com/{owner}/{repo}/actions/workflows/docker.yml/badge.svg)
```

**View logs:**
```
Repository → Actions → Select workflow → Select run → View details
```

## 🔄 Complete Workflow Flow

```
Commit to main
    ↓
[TEST WORKFLOW] - Check code quality
    ├─ Install dependencies
    ├─ Run tests
    ├─ Check syntax
    └─ Verify files
    ↓
[RELEASE WORKFLOW] - Create release (if version changed)
    ├─ Run tests again
    ├─ Generate changelog
    └─ Create GitHub Release
    ↓
[DOCKER WORKFLOW] - Build & push image
    ├─ Run tests again
    ├─ Build Docker image
    ├─ Push to ghcr.io
    └─ Scan for vulnerabilities
    ↓
Deploy!
```

## 🚀 Deployment Examples

### Production Deployment

```bash
# Pull latest image
docker pull ghcr.io/whiteravens20/exemplar:latest

# Run with compose
docker-compose up -d
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: discord-bot
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: discord-bot
        image: ghcr.io/whiteravens20/exemplar:latest
        imagePullPolicy: Always
        envFrom:
        - secretRef:
            name: discord-bot-secrets
```

## 🔒 Security

### What's Scanned

- ✅ Docker image (Trivy)
- ✅ JavaScript dependencies
- ✅ Package versions (locked in package-lock.json)
- ✅ File permissions (non-root user in Docker)

### Vulnerability Reports

Check security findings:
```
Repository → Security → Code scanning alerts
```

## 📝 Logs & Debugging

### View Workflow Logs

1. Go to `Repository → Actions`
2. Click on the workflow name
3. Click on the run
4. Click on the job
5. Expand sections to see logs

### Common Issues

**Test fails:**
- Check if `src/` directory has syntax errors
- Verify `.env.example` has all required variables
- Ensure `package.json` is valid JSON

**Release fails:**
- Version must be valid semver (e.g., `1.0.0`)
- Commit message should have meaningful content
- Check if tag already exists

**Docker build fails:**
- Ensure `Dockerfile` exists
- Check if syntax errors in source code
- Verify dependencies in `package.json`

## 🔧 Customization

### Change Node.js Version

Edit `.github/workflows/*.yml`:
```yaml
strategy:
  matrix:
    node-version: [22.x]  # Change here
```

### Change Test Conditions

Edit `.github/workflows/test.yml`:
```yaml
on:
  push:
    branches: [ main, develop ]  # Add/remove branches
  pull_request:
    branches: [ main, develop ]
```

### Change Release Conditions

Edit `.github/workflows/release.yml`:
```yaml
on:
  push:
    branches: [ main ]  # Branches that trigger release
    paths-ignore:
      - '**.md'  # Don't create release on doc changes
```

### Add Custom Tests

Edit `.github/workflows/test.yml` and add:
```yaml
- name: Custom Test
  run: npm run your-custom-test
```

## 📚 References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Action](https://github.com/docker/build-push-action)
- [Trivy Security Scanner](https://aquasecurity.github.io/trivy/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

## ❓ FAQ

**Q: How do I create a release?**
A: Update version in `package.json` and push to `main`. Release is created automatically.

**Q: Where are Docker images stored?**
A: In GitHub Container Registry at `ghcr.io/{owner}/{repo}`

**Q: Can I run workflows manually?**
A: Yes! Go to Actions → Select workflow → Run workflow

**Q: How are security scans done?**
A: Using Trivy on built Docker images. Results in Security tab.

**Q: What if tests fail?**
A: Release and Docker build won't proceed. Fix issues and push again.
