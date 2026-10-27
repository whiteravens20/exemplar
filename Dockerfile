# Both stages start from the same base image, pinned by version and digest: the
# digest is what gets pulled, the version says what it is. Dependabot moves both
# (.github/dependabot.yml).

# Build stage
FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS builder

WORKDIR /app

# Patch Alpine base packages
RUN apk upgrade --no-cache

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
FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f

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

# Remove the package managers. The container starts with plain node, so npm,
# npx, corepack and yarn are build-time tools only, and each brings its own
# dependency tree, with its own advisories, into the image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-v*

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
