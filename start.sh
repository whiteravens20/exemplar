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
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Test configuration
echo "🧪 Testing configuration..."
node test-config.js

if [ $? -ne 0 ]; then
    echo "❌ Configuration test failed!"
    exit 1
fi

echo ""
echo "✅ All checks passed!"
echo "🚀 Starting bot..."
echo ""

# Start the bot
npm start
