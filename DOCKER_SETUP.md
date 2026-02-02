# Docker Setup Guide

This guide explains how to run the Discord AI Assistant Bot in Docker.

## Prerequisites

- Docker installed ([Download Docker](https://www.docker.com/products/docker-desktop))
- Docker Compose installed (usually comes with Docker Desktop)
- Discord Bot Token
- n8n Workflow URL and API Key

## Quick Start

### 1. Configure Environment Variables

Copy the example environment file and update it with your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_SERVER_ID=your_server_id_for_ai_assistant
N8N_WORKFLOW_URL=https://your-n8n-instance.com/webhook/workflow
N8N_API_KEY=your_n8n_api_key_here
BOT_PREFIX=!
HARDCODED_MENTION_RESPONSE=Hi! I'm an AI Assistant. Send me a DM to chat with me.
ALLOWED_ROLES_FOR_AI=role_id_1,role_id_2,role_id_3
RESTRICTED_RESPONSE=You don't have permission to use this feature. Please contact the admins.
NODE_ENV=production
```

### 2. Build and Run with Docker Compose

```bash
# Build the Docker image
docker-compose build

# Start the bot in the background
docker-compose up -d

# View logs
docker-compose logs -f discord-bot

# Stop the bot
docker-compose down
```

### 3. Build Manually (without Docker Compose)

#### Option 1: Using .env file (Recommended)
```bash
# Build the image
docker build -t discord-ai-bot:latest .

# Run the container
docker run -d \
  --name discord-ai-bot \
  --restart unless-stopped \
  --env-file .env \
  -e NODE_ENV=production \
  -v $(pwd)/logs:/app/logs \
  --memory 512m \
  --cpus 1 \
  discord-ai-bot:latest
```

#### Option 2: Using Direct Environment Variables (No .env File)
```bash
# Build the image
docker build -t discord-ai-bot:latest .

# Run the container with environment variables directly
docker run -d \
  --name discord-ai-bot \
  --restart unless-stopped \
  -e DISCORD_TOKEN=your_discord_bot_token_here \
  -e DISCORD_CLIENT_ID=your_client_id_here \
  -e DISCORD_SERVER_ID=your_server_id_for_ai_assistant \
  -e N8N_WORKFLOW_URL=https://your-n8n-instance.com/webhook/workflow \
  -e N8N_API_KEY=your_n8n_api_key_here \
  -e BOT_PREFIX=! \
  -e HARDCODED_MENTION_RESPONSE="Hi! I'm an AI Assistant. Send me a DM to chat with me." \
  -e ALLOWED_ROLES_FOR_AI=role_id_1,role_id_2,role_id_3 \
  -e RESTRICTED_RESPONSE="You don't have permission to use this feature. Please contact the admins." \
  -e NODE_ENV=production \
  -e DOCKER=true \
  -v $(pwd)/logs:/app/logs \
  --memory 512m \
  --cpus 1 \
  discord-ai-bot:latest
```

### 4. Container Management

```bash
# View logs
docker logs -f discord-ai-bot

# Stop the container
docker stop discord-ai-bot
docker rm discord-ai-bot
```

## Docker Features

### Multi-Stage Build

The Dockerfile uses a multi-stage build process:

1. **Builder Stage**: Installs dependencies with optimized npm configuration
2. **Runtime Stage**: Contains only the necessary files for running the application, reducing final image size

### Security Best Practices

- **Non-Root User**: Bot runs as `nodejs` user (UID 1001) for security
- **No New Privileges**: Container cannot escalate privileges
- **Minimal Capabilities**: Only required capabilities are allowed
- **Read-Only Root Filesystem**: Reduced attack surface
- **dumb-init**: Proper signal handling for graceful shutdown

### Resource Management

- **CPU Limit**: 1 CPU maximum
- **Memory Limit**: 512MB maximum
- **Reserved Resources**: 0.5 CPU and 256MB memory guaranteed

### Health Checks

The container includes a health check that runs every 30 seconds. If the health check fails 3 times, the container is marked as unhealthy.

### Logging

- **Driver**: JSON file logging
- **Max Size**: 10MB per log file
- **Max Files**: 3 rotated log files
- **Logs Location**: `/var/lib/docker/containers/<container-id>/<container-id>-json.log`

## Volume Mounts

```yaml
volumes:
  - ./logs:/app/logs  # Persist application logs
```

To access logs from the container:

```bash
docker-compose exec discord-bot ls -la logs/
docker-compose exec discord-bot tail -f logs/combined.log
```

## Network Configuration

The service uses a custom bridge network `bot-network` for better isolation. If you need to connect other services (like n8n), add them to the same network:

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    networks:
      - bot-network
    environment:
      - N8N_HOST=n8n
      - N8N_PORT=5678
```

Then update your `.env` to use the service name as hostname:

```env
N8N_WORKFLOW_URL=http://n8n:5678/webhook/workflow
```

## Common Commands

```bash
# View running containers
docker-compose ps

# View container logs (last 100 lines, follow output)
docker-compose logs -f --tail=100 discord-bot

# Restart the bot
docker-compose restart discord-bot

# Stop the bot
docker-compose stop discord-bot

# Start the bot
docker-compose start discord-bot

# Execute command in running container
docker-compose exec discord-bot node test-config.js

# Remove containers, networks (keeps volumes)
docker-compose down

# Remove everything including volumes
docker-compose down -v

# Rebuild without cache
docker-compose build --no-cache

# Pull latest image and rebuild
docker-compose pull && docker-compose up -d --build
```

## Troubleshooting

### Container exits immediately

Check the logs:

```bash
docker-compose logs discord-bot
```

Common issues:
- Missing or incorrect `.env` file
- Invalid Discord token
- n8n URL unreachable

### Memory usage is high

Monitor container resource usage:

```bash
docker stats discord-bot
```

Increase memory limits in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 1G  # Increase from 512M
```

### Bot not responding to messages

1. Verify Discord token is correct:
   ```bash
   docker-compose exec discord-bot node -e "console.log(process.env.DISCORD_TOKEN)"
   ```

2. Check bot permissions in Discord server
3. Verify bot is running:
   ```bash
   docker-compose ps
   ```

### n8n webhook is unreachable

If using Docker Compose with n8n service on same network:

```bash
# Test connectivity
docker-compose exec discord-bot curl -v http://n8n:5678/webhook/workflow
```

## Production Deployment

### Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml discord-bot

# View services
docker service ls

# View logs
docker service logs discord-bot_discord-bot
```

### Kubernetes

Create a `kubernetes.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: discord-bot
spec:
  replicas: 1
  selector:
    matchLabels:
      app: discord-bot
  template:
    metadata:
      labels:
        app: discord-bot
    spec:
      containers:
      - name: discord-bot
        image: discord-ai-bot:latest
        envFrom:
        - configMapRef:
            name: discord-bot-config
        resources:
          limits:
            memory: "512Mi"
            cpu: "1000m"
          requests:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - node
            - -e
            - "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
          initialDelaySeconds: 5
          periodSeconds: 30
```

Deploy with:

```bash
kubectl apply -f kubernetes.yaml
```

## Image Size Optimization

Current image size: ~200MB (with Node.js 20-alpine and dependencies)

To further reduce size:

```dockerfile
# Remove optional dependencies
RUN npm ci --only=production --no-optional

# Use node:20-alpine3.18 (smallest available)
FROM node:20-alpine3.18
```

## Updating the Bot

```bash
# Pull latest changes
git pull origin main

# Rebuild image
docker-compose build --no-cache

# Restart service
docker-compose up -d
```

## Environment-Specific Configurations

Create separate compose files for different environments:

```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

In `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  discord-bot:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
```

## Support

For issues or questions:

1. Check [FAQ.md](FAQ.md)
2. Review [N8N_INTEGRATION.md](N8N_INTEGRATION.md)
3. Check logs: `docker-compose logs discord-bot`
4. See [CONTRIBUTING.md](CONTRIBUTING.md) for support options
