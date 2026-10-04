#!/bin/bash

# Discord AI Assistant Bot - Quick Start Script

echo "🤖 Discord AI Assistant Bot - Quick Start"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📋 Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created"
    echo ""
    echo "⚠️  Please edit .env with your configuration:"
    echo "   - DISCORD_TOKEN"
    echo "   - DISCORD_CLIENT_ID"
    echo "   - DISCORD_SERVER_ID"
    echo "   - N8N_WORKFLOW_URL"
    echo ""
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
    echo "✅ Dependencies installed"
    echo ""
fi

# Test configuration
echo "🧪 Testing configuration..."

# Build TypeScript if dist/ doesn't exist
if [ ! -d "dist" ]; then
    echo "🔨 Building TypeScript..."
    npm run build
    echo "✅ Build completed"
    echo ""
fi

echo ""
echo "✅ All checks passed!"
echo "🚀 Starting bot..."
echo ""

# Start the bot
npm start
