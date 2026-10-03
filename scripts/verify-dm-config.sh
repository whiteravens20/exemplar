#!/bin/bash
# DM Verification Script
# Run this to check if your bot is properly configured for DMs

echo "🔍 Bot DM Configuration Check"
echo "=============================="
echo ""

# Check if bot is running
echo "1. Checking if bot process is running..."
if pgrep -f "node dist/index.js" > /dev/null; then
    echo "   ✅ Bot is running (PID: $(pgrep -f 'node dist/index.js'))"
else
    echo "   ❌ Bot is NOT running"
    echo "   Run: npm run build && npm start"
    exit 1
fi
echo ""

# Check for Partials in code
echo "2. Checking for Partials configuration..."
if grep -q "Partials.Channel" src/index.ts && grep -q "Partials.Message" src/index.ts; then
    echo "   ✅ Partials configured correctly"
else
    echo "   ❌ Partials missing - DMs won't work!"
    exit 1
fi
echo ""

# Check intents
echo "3. Checking Gateway Intents..."
if grep -q "GatewayIntentBits.DirectMessages" src/index.ts; then
    echo "   ✅ DirectMessages intent enabled"
else
    echo "   ❌ DirectMessages intent missing"
    exit 1
fi

if grep -q "GatewayIntentBits.MessageContent" src/index.ts; then
    echo "   ✅ MessageContent intent enabled"
else
    echo "   ❌ MessageContent intent missing"
    exit 1
fi
echo ""

# Check last logs
echo "4. Checking recent logs..."
if [ -f "logs/combined.log" ]; then
    LAST_READY=$(tail -n 50 logs/combined.log | grep "Bot is ready" | tail -1)
    if [ -n "$LAST_READY" ]; then
        echo "   ✅ Bot successfully connected"
        echo "   $LAST_READY"
    else
        echo "   ⚠️  No recent 'ready' message in logs"
    fi
else
    echo "   ⚠️  No log file found"
fi
echo ""

# Check for errors
echo "5. Checking for errors in last 10 lines..."
if [ -f "logs/error.log" ]; then
    ERROR_COUNT=$(tail -n 10 logs/error.log 2>/dev/null | wc -l)
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo "   ⚠️  Found $ERROR_COUNT recent error(s):"
        tail -n 3 logs/error.log | sed 's/^/      /'
    else
        echo "   ✅ No recent errors"
    fi
else
    echo "   ✅ No error log (good!)"
fi
echo ""

# Check environment
echo "6. Checking .env configuration..."
if [ -f ".env" ]; then
    if grep -q "DISCORD_TOKEN=" .env && ! grep -q "DISCORD_TOKEN=your_" .env; then
        echo "   ✅ DISCORD_TOKEN is set"
    else
        echo "   ❌ DISCORD_TOKEN not configured"
    fi
    
    if grep -q "N8N_WORKFLOW_URL=" .env && ! grep -q "N8N_WORKFLOW_URL=https://your-" .env; then
        echo "   ✅ N8N_WORKFLOW_URL is set"
    else
        echo "   ⚠️  N8N_WORKFLOW_URL not configured (optional)"
    fi
    
    # Check allowed roles
    ROLES=$(grep "ALLOWED_ROLES_FOR_AI=" .env | cut -d'=' -f2)
    if [ -z "$ROLES" ]; then
        echo "   ℹ️  ALLOWED_ROLES_FOR_AI is empty (everyone can use AI)"
    else
        echo "   ℹ️  ALLOWED_ROLES_FOR_AI: $ROLES"
    fi
else
    echo "   ❌ .env file not found"
    exit 1
fi
echo ""

# Final instructions
echo "=============================="
echo "📝 Next Steps:"
echo ""
echo "1. Send a DM to your bot in Discord"
echo "2. Monitor logs with: tail -f logs/combined.log"
echo "3. Look for: 📨 Message received { isDM: true }"
echo ""
echo "If DMs still don't work:"
echo "- Check Privileged Gateway Intents in Discord Developer Portal"
echo "- Ensure MESSAGE CONTENT INTENT is enabled"
echo "- Restart bot: pkill -f 'node dist/index.js' && npm run build && npm start"
echo ""
echo "For detailed troubleshooting, see docs/FAQ.md"
