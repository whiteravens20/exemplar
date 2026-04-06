# Build stage
FROM node:25.9.0-alpine AS builder

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

# Copy source files
COPY src/ ./src/

# Build TypeScript
RUN npx tsc

# Remove dev dependencies
RUN npm prune --production --ignore-scripts

# Runtime stage
FROM node:25.9.0-alpine

WORKDIR /app

# Patch Alpine base packages
RUN apk upgrade --no-cache

# Install dumb-init and wget for health checks
RUN apk add --no-cache dumb-init wget

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built JS output
COPY --from=builder /app/dist ./dist

# Copy other necessary files
COPY package*.json ./
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
    CMD node -e "import('http').then(h => h.get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(String(r.statusCode))}))" || exit 1

# Set entrypoint to handle database initialization
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]

# Run the application
CMD ["dumb-init", "node", "dist/index.js"]
