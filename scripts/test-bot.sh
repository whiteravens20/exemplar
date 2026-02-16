#!/bin/bash

# Test script to verify bot configuration and dependencies

# Disable strict locale check to avoid issues with grep
export LC_ALL=C
#set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🧪 Running Bot Configuration Tests...${NC}\n"

TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
  local test_name=$1
  local test_cmd=$2
  
  echo -n "  Testing: $test_name... "
  
  if eval "$test_cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}❌${NC}"
    ((TESTS_FAILED++))
    return 1
  fi
  return 0
}

# 1. Check Node.js version
echo -e "${BLUE}1️⃣ Checking Node.js...${NC}"
# Get Node.js and npm versions
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo "Node.js version: ${NODE_VERSION}"
echo "npm version: ${NPM_VERSION}"
# Check Node.js version
if [[ "$NODE_VERSION" =~ v(2[0-9]|[3-9][0-9]) ]]; then
    echo -e "  Testing: Node.js 20+ installed... ${GREEN}✅${NC}"
    ((TESTS_PASSED++))
else
    echo -e "  Testing: Node.js 20+ installed... ${RED}❌${NC}"
    ((TESTS_FAILED++))
fi
# Check npm version
if [[ "$NPM_VERSION" =~ ^(1[1-9]|[2-9][0-9]|[1-9][0-9][0-9]) ]]; then
    echo -e "  Testing: npm 11+ installed... ${GREEN}✅${NC}"
    ((TESTS_PASSED++))
else
    echo -e "  Testing: npm 11+ installed... ${RED}❌${NC}"
    ((TESTS_FAILED++))
fi

# 2. Check dependencies
echo -e "\n${BLUE}2️⃣ Checking Dependencies...${NC}"
run_test "discord.js installed" "npm ls discord.js"
run_test "dotenv installed" "npm ls dotenv"
run_test "axios installed" "npm ls axios"
run_test "winston installed" "npm ls winston"
run_test "pg installed" "npm ls pg"
run_test "express installed" "npm ls express"

# 3. Check file structure
echo -e "\n${BLUE}3️⃣ Checking File Structure...${NC}"
run_test "src/index.js exists" "test -f src/index.js"
run_test "src/deploy-commands.js exists" "test -f src/deploy-commands.js"
run_test "src/config/ exists" "test -d src/config"
run_test "src/events/ exists" "test -d src/events"
run_test "src/slashcommands/ exists" "test -d src/slashcommands"
run_test "src/utils/ exists" "test -d src/utils"
run_test "src/db/ exists" "test -d src/db"
run_test "src/db/repositories/ exists" "test -d src/db/repositories"
run_test "src/api/ exists" "test -d src/api"
run_test "src/jobs/ exists" "test -d src/jobs"
run_test "migrations/ exists" "test -d migrations"
run_test "scripts/migrate.js exists" "test -f scripts/migrate.js"

# 4. Check configuration
echo -e "\n${BLUE}4️⃣ Checking Configuration...${NC}"
run_test ".env.example exists" "test -f .env.example"
run_test "DISCORD_TOKEN in .env.example" "grep -q 'DISCORD_TOKEN' .env.example"
run_test "N8N_WORKFLOW_URL in .env.example" "grep -q 'N8N_WORKFLOW_URL' .env.example"
run_test "DB_HOST in .env.example" "grep -q 'DB_HOST' .env.example"
run_test "DB_PASSWORD in .env.example" "grep -q 'DB_PASSWORD' .env.example"
run_test "HEALTH_CHECK_PORT in .env.example" "grep -q 'HEALTH_CHECK_PORT' .env.example"

# 5. Check syntax
echo -e "\n${BLUE}5️⃣ Checking JavaScript Syntax...${NC}"
run_test "src/index.js syntax" "node -c src/index.js"
run_test "src/deploy-commands.js syntax" "node -c src/deploy-commands.js"

# Check all event files
for file in src/events/*.js; do
  filename=$(basename "$file")
  run_test "src/events/$filename syntax" "node -c $file"
done

# Check all command files
for file in src/slashcommands/*.js; do
  filename=$(basename "$file")
  run_test "src/slashcommands/$filename syntax" "node -c $file"
done

# Check all util files
for file in src/utils/*.js; do
  filename=$(basename "$file")
  run_test "src/utils/$filename syntax" "node -c $file"
done

# Check database files
if [ -d "src/db" ]; then
  for file in src/db/*.js; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      run_test "src/db/$filename syntax" "node -c $file"
    fi
  done
  
  if [ -d "src/db/repositories" ]; then
    for file in src/db/repositories/*.js; do
      if [ -f "$file" ]; then
        filename=$(basename "$file")
        run_test "src/db/repositories/$filename syntax" "node -c $file"
      fi
    done
  fi
fi
run_test "migrate:up script exists" "node -p \"require('./package.json').scripts['migrate:up']\""
run_test "migrate:down script exists" "node -p \"require('./package.json').scripts['migrate:down']\""

# 9. Check database migrations
echo -e "\n${BLUE}9️⃣ Checking Database Migrations...${NC}"
run_test "migrations directory exists" "test -d migrations"
run_test "001_initial_schema.sql exists" "test -f migrations/001_initial_schema.sql"
run_test "002_cleanup_functions.sql exists" "test -f migrations/002_cleanup_functions.sql"
run_test "003_analytics_schema.sql exists" "test -f migrations/003_analytics_schema.sql"

# Check API files
if [ -d "src/api" ]; then
  for file in src/api/*.js; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      run_test "src/api/$filename syntax" "node -c $file"
    fi
  done
fi

# Check jobs files
if [ -d "src/jobs" ]; then
  for file in src/jobs/*.js; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      run_test "src/jobs/$filename syntax" "node -c $file"
    fi
  done
fi

# 6. Check Docker configuration
echo -e "\n${BLUE}6️⃣ Checking Docker Configuration...${NC}"
run_test "Dockerfile exists" "test -f Dockerfile"
run_test "docker-compose.yml exists" "test -f docker-compose.yml"
run_test ".dockerignore exists" "test -f .dockerignore"

# 7. Check package.json
echo -e "\n${BLUE}7️⃣ Checking package.json...${NC}"
run_test "valid JSON" "node -e \"require('./package.json')\""
run_test "main field set" "node -p \"require('./package.json').main\" | grep -q 'src/index.js'"
run_test "Node.js 22+ required" "grep -q '\"node\": \">=22.0.0\"' package.json"
run_test "npm 11+ required" "grep -q '\"npm\": \">=11.0.0\"' package.json"

# 8. Check scripts
echo -e "\n${BLUE}8️⃣ Checking npm Scripts...${NC}"
run_test "start script exists" "node -p \"require('./package.json').scripts.start\""
run_test "dev script exists" "node -p \"require('./package.json').scripts.dev\""
run_test "test-config script exists" "node -p \"require('./package.json').scripts['test-config']\""

# Summary
echo -e "\n${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}📊 Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✅ All tests passed! Bot is ready to run.${NC}\n"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed. Please fix the issues above.${NC}\n"
  exit 1
fi
