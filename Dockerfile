# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Update npm to 11+ for security fixes (tar, glob, diff vulnerabilities)
# Patch npm bundled deps: tar (CVE-2026-26960) and minimatch (CVE-2026-27903, CVE-2026-27904)
# Install in a temp dir (avoids reading npm's own package.json) then overwrite
RUN npm install -g npm@latest && \
    mkdir -p /tmp/npm-patches && \
    cd /tmp/npm-patches && \
    npm install tar@7.5.8 minimatch@10.2.4 && \
    cp -r node_modules/tar node_modules/minimatch /usr/local/lib/node_modules/npm/node_modules/ && \
    cd / && rm -rf /tmp/npm-patches

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Update npm to 11+ for security fixes
# Patch npm bundled deps: tar (CVE-2026-26960) and minimatch (CVE-2026-27903, CVE-2026-27904)
RUN npm install -g npm@latest && \
    mkdir -p /tmp/npm-patches && \
    cd /tmp/npm-patches && \
    npm install tar@7.5.8 minimatch@10.2.4 && \
    cp -r node_modules/tar node_modules/minimatch /usr/local/lib/node_modules/npm/node_modules/ && \
    cd / && rm -rf /tmp/npm-patches

# Install dumb-init and wget for health checks
RUN apk add --no-cache dumb-init wget

# Copy built node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY package*.json ./
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/
COPY .env.example ./

# Make entrypoint script executable
RUN chmod +x ./scripts/docker-entrypoint.sh

# Check if .env exists, if not create it from .env.example
RUN if [ ! -f .env ]; then cp .env.example .env; fi

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Set entrypoint to handle database initialization
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]

# Run the application
CMD ["dumb-init", "node", "src/index.js"]
