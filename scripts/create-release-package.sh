#!/bin/bash

# Script to create a release package with only essential files

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📦 Creating Release Package...${NC}\n"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
RELEASE_DIR="dist/discord-ai-bot-v${VERSION}"

# Clean previous builds
rm -rf dist/
mkdir -p "$RELEASE_DIR"

# Files and directories to include
echo -e "${BLUE}📋 Copying essential files...${NC}"
cp -r src "$RELEASE_DIR/"
cp -r node_modules "$RELEASE_DIR/" 2>/dev/null || npm ci --production && cp -r node_modules "$RELEASE_DIR/"
cp package.json "$RELEASE_DIR/"
cp package-lock.json "$RELEASE_DIR/" 2>/dev/null || true
cp .env.example "$RELEASE_DIR/"
cp Dockerfile "$RELEASE_DIR/"
cp docker-compose.yml "$RELEASE_DIR/"
cp start.sh "$RELEASE_DIR/"
cp README.md "$RELEASE_DIR/"
cp DOCKER_SETUP.md "$RELEASE_DIR/"
cp LICENSE "$RELEASE_DIR/"

# Create artifacts
echo -e "${BLUE}📦 Creating archives...${NC}"

# ZIP archive
cd dist
zip -r "discord-ai-bot-v${VERSION}.zip" "discord-ai-bot-v${VERSION}" -q
echo -e "${GREEN}✅ Created: discord-ai-bot-v${VERSION}.zip${NC}"

# TAR archive
tar -czf "discord-ai-bot-v${VERSION}.tar.gz" "discord-ai-bot-v${VERSION}" --quiet
echo -e "${GREEN}✅ Created: discord-ai-bot-v${VERSION}.tar.gz${NC}"

# Create checksum file
sha256sum discord-ai-bot-v*.{zip,tar.gz} > checksums.txt
echo -e "${GREEN}✅ Created: checksums.txt${NC}"

cd ..

# Summary
echo -e "\n${GREEN}✅ Release package created successfully!${NC}\n"
echo -e "${BLUE}📍 Location:${NC} dist/"
echo -e "${BLUE}📦 Artifacts:${NC}"
echo "  - dist/discord-ai-bot-v${VERSION}.zip"
echo "  - dist/discord-ai-bot-v${VERSION}.tar.gz"
echo "  - dist/checksums.txt"
echo ""
echo -e "${BLUE}📊 Package Contents:${NC}"
du -sh "$RELEASE_DIR"
echo "  src/"
echo "  node_modules/"
echo "  package.json"
echo "  .env.example"
echo "  Dockerfile"
echo "  docker-compose.yml"
echo "  start.sh"
echo "  README.md & DOCKER_SETUP.md"
echo "  LICENSE"
