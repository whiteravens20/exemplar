#!/bin/bash

# Test script to verify bot configuration and dependencies

# Disable strict locale check to avoid issues with grep
export LC_ALL=C
set -e

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
run_test "Node.js 20+ installed" "node -v | grep -E 'v(2[0-9]|[3-9][0-9])'"
run_test "npm 10+ installed" "npm -v | grep -E '^(10|[1-9][0-9])'"

# 2. Check dependencies
echo -e "\n${BLUE}2️⃣ Checking Dependencies...${NC}"
run_test "discord.js installed" "npm ls discord.js"
run_test "dotenv installed" "npm ls dotenv"
run_test "axios installed" "npm ls axios"
run_test "winston installed" "npm ls winston"

# 3. Check file structure
echo -e "\n${BLUE}3️⃣ Checking File Structure...${NC}"
run_test "src/index.js exists" "test -f src/index.js"
run_test "src/deploy-commands.js exists" "test -f src/deploy-commands.js"
run_test "src/config/ exists" "test -d src/config"
run_test "src/events/ exists" "test -d src/events"
run_test "src/slashcommands/ exists" "test -d src/slashcommands"
run_test "src/utils/ exists" "test -d src/utils"

# 4. Check configuration
echo -e "\n${BLUE}4️⃣ Checking Configuration...${NC}"
run_test ".env.example exists" "test -f .env.example"
run_test "DISCORD_TOKEN in .env.example" "grep -q 'DISCORD_TOKEN' .env.example"
run_test "N8N_WORKFLOW_URL in .env.example" "grep -q 'N8N_WORKFLOW_URL' .env.example"

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

# 6. Check Docker configuration
echo -e "\n${BLUE}6️⃣ Checking Docker Configuration...${NC}"
run_test "Dockerfile exists" "test -f Dockerfile"
run_test "docker-compose.yml exists" "test -f docker-compose.yml"
run_test ".dockerignore exists" "test -f .dockerignore"

# 7. Check package.json
echo -e "\n${BLUE}7️⃣ Checking package.json...${NC}"
run_test "valid JSON" "node -e \"require('./package.json')\""
run_test "main field set" "node -p \"require('./package.json').main\" | grep -q 'src/index.js'"
run_test "Node.js 20+ required" "grep -q '\"node\": \">=20.0.0\"' package.json"
run_test "npm 10+ required" "grep -q '\"npm\": \">=10.0.0\"' package.json"

# 8. Check scripts
echo -e "\n${BLUE}8️⃣ Checking npm Scripts...${NC}"
run_test "start script exists" "node -p \"require('./package.json').scripts.start\""
run_test "dev script exists" "node -p \"require('./package.json').scripts.dev\""
run_test "test-config script exists" "node -p \"require('./package.json').scripts['test-config']\""

# 9. Check documentation
echo -e "\n${BLUE}9️⃣ Checking Documentation...${NC}"
run_test "README.md exists" "test -f README.md"
run_test "DOCKER_SETUP.md exists" "test -f DOCKER_SETUP.md"
run_test "LICENSE exists" "test -f LICENSE"

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
