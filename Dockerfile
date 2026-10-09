# Both stages start from the same base image, pinned by version and digest: the
# digest is what gets pulled, the version says what it is. Dependabot moves both
# (.github/dependabot.yml).

# Build stage
FROM node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS builder

WORKDIR /app

# Patch Alpine base packages
RUN apk upgrade --no-cache

# Upgrade npm to the version required by package.json `engines` (>=11.12.1).
# node:22-alpine ships npm 10, which cannot validate lockfiles that use nested
# overrides and fails `npm ci` with a spurious "does not satisfy" error.
RUN npm install -g npm@latest

# Copy .npmrc for supply-chain hardening (min-release-age, ignore-scripts)
COPY .npmrc ./

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for build)
# --ignore-scripts blocks postinstall malware vectors
RUN npm ci --ignore-scripts

# Copy source files and the build helper that copies the dashboard assets and
# translations
COPY src/ ./src/
COPY scripts/copy-assets.mjs ./scripts/

# Build TypeScript and copy the dashboard assets and translations into dist/
RUN npm run build

# Remove dev dependencies. TypeScript is an optional peer of i18next, which
# npm keeps under --omit=dev alone; the only other optional package in the
# production tree, pg-cloudflare, is never loaded on Node.
RUN npm prune --omit=dev --omit=optional --ignore-scripts

# Runtime stage
FROM node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

WORKDIR /app

# Patch Alpine base packages
RUN apk upgrade --no-cache

# Install dumb-init and wget for health checks
RUN apk add --no-cache dumb-init wget

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built JS output
COPY --from=builder /app/dist ./dist

# Copy only necessary files
COPY package.json ./
COPY migrations/ ./migrations/
COPY scripts/docker-entrypoint.sh ./scripts/

# Make entrypoint script executable
RUN chmod +x ./scripts/docker-entrypoint.sh

# Remove npm (not needed in runtime; eliminates npm's own CVEs)
RUN npm uninstall -g npm && rm -rf /usr/local/lib/node_modules/npm

# Create non-root user for security. /app/logs exists in the image so that a
# named volume mounted there starts out owned by that user; the root filesystem
# is read-only under docker-compose.yml, so the bot could not create it itself.
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Health check (using wget, lighter than node -e)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO /dev/null http://localhost:3000/health || exit 1

# Set entrypoint to handle database initialization
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]

# Run the application
CMD ["dumb-init", "node", "dist/index.js"]
