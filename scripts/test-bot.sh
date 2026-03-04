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
# Check Node.js version (22+)
if [[ "$NODE_VERSION" =~ v(2[2-9]|[3-9][0-9]) ]]; then
    echo -e "  Testing: Node.js 22+ installed... ${GREEN}✅${NC}"
    ((TESTS_PASSED++))
else
    echo -e "  Testing: Node.js 22+ installed... ${RED}❌${NC}"
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
run_test "typescript installed" "npm ls typescript"
run_test "vitest installed" "npm ls vitest"

# 3. Check file structure
echo -e "\n${BLUE}3️⃣ Checking File Structure...${NC}"
run_test "src/index.ts exists" "test -f src/index.ts"
run_test "src/deploy-commands.ts exists" "test -f src/deploy-commands.ts"
run_test "tsconfig.json exists" "test -f tsconfig.json"
run_test "vitest.config.ts exists" "test -f vitest.config.ts"
run_test "src/types/ exists" "test -d src/types"
run_test "src/config/ exists" "test -d src/config"
run_test "src/events/ exists" "test -d src/events"
run_test "src/slashcommands/ exists" "test -d src/slashcommands"
run_test "src/utils/ exists" "test -d src/utils"
run_test "src/db/ exists" "test -d src/db"
run_test "src/db/repositories/ exists" "test -d src/db/repositories"
run_test "src/api/ exists" "test -d src/api"
run_test "src/jobs/ exists" "test -d src/jobs"
run_test "migrations/ exists" "test -d migrations"
run_test "scripts/migrate.ts exists" "test -f scripts/migrate.ts"

# 4. Check configuration
echo -e "\n${BLUE}4️⃣ Checking Configuration...${NC}"
run_test ".env.example exists" "test -f .env.example"
run_test "DISCORD_TOKEN in .env.example" "grep -q 'DISCORD_TOKEN' .env.example"
run_test "N8N_WORKFLOW_URL in .env.example" "grep -q 'N8N_WORKFLOW_URL' .env.example"
run_test "DB_HOST in .env.example" "grep -q 'DB_HOST' .env.example"
run_test "DB_PASSWORD in .env.example" "grep -q 'DB_PASSWORD' .env.example"
run_test "HEALTH_CHECK_PORT in .env.example" "grep -q 'HEALTH_CHECK_PORT' .env.example"

# 5. Check TypeScript compilation
echo -e "\n${BLUE}5️⃣ Checking TypeScript Compilation...${NC}"
run_test "tsc --noEmit (type check)" "npx tsc --noEmit"

# Check all TypeScript source files exist
for file in src/events/*.ts; do
  filename=$(basename "$file")
  run_test "src/events/$filename exists" "test -f $file"
done

for file in src/slashcommands/*.ts; do
  filename=$(basename "$file")
  run_test "src/slashcommands/$filename exists" "test -f $file"
done

for file in src/utils/*.ts; do
  filename=$(basename "$file")
  run_test "src/utils/$filename exists" "test -f $file"
done

for file in src/types/*.ts; do
  filename=$(basename "$file")
  run_test "src/types/$filename exists" "test -f $file"
done

# 6. Check Docker configuration
echo -e "\n${BLUE}6️⃣ Checking Docker Configuration...${NC}"
run_test "Dockerfile exists" "test -f Dockerfile"
run_test "docker-compose.yml exists" "test -f docker-compose.yml"
run_test ".dockerignore exists" "test -f .dockerignore"

# 7. Check package.json
echo -e "\n${BLUE}7️⃣ Checking package.json...${NC}"
run_test "valid JSON" "node --input-type=module -e \"import{readFileSync}from'fs';JSON.parse(readFileSync('./package.json','utf8'));\""
run_test "main field set to dist/index.js" "node --input-type=module -e \"import{readFileSync}from'fs';const p=JSON.parse(readFileSync('./package.json','utf8'));if(p.main!=='dist/index.js')process.exit(1);\""
run_test "type field set to module" "node --input-type=module -e \"import{readFileSync}from'fs';const p=JSON.parse(readFileSync('./package.json','utf8'));if(p.type!=='module')process.exit(1);\""
run_test "Node.js 22+ required" "grep -q '\"node\": \">=22.0.0\"' package.json"
run_test "npm 11+ required" "grep -q '\"npm\": \">=11.0.0\"' package.json"

# 8. Check npm scripts
echo -e "\n${BLUE}8️⃣ Checking npm Scripts...${NC}"
run_test "start script exists" "node --input-type=module -e \"import{readFileSync}from'fs';const p=JSON.parse(readFileSync('./package.json','utf8'));if(!p.scripts.start)process.exit(1);\""
run_test "dev script exists" "node --input-type=module -e \"import{readFileSync}from'fs';const p=JSON.parse(readFileSync('./package.json','utf8'));if(!p.scripts.dev)process.exit(1);\""
run_test "build script exists" "node --input-type=module -e \"import{readFileSync}from'fs';const p=JSON.parse(readFileSync('./package.json','utf8'));if(!p.scripts.build)process.exit(1);\""
run_test "typecheck script exists" "node --input-type=module -e \"import{readFileSync}from'fs';const p=JSON.parse(readFileSync('./package.json','utf8'));if(!p.scripts.typecheck)process.exit(1);\""
run_test "migrate:up script exists" "node --input-type=module -e \"import{readFileSync}from'fs';const p=JSON.parse(readFileSync('./package.json','utf8'));if(!p.scripts['migrate:up'])process.exit(1);\""
run_test "migrate:down script exists" "node --input-type=module -e \"import{readFileSync}from'fs';const p=JSON.parse(readFileSync('./package.json','utf8'));if(!p.scripts['migrate:down'])process.exit(1);\""

# 9. Check database migrations
echo -e "\n${BLUE}9️⃣ Checking Database Migrations...${NC}"
run_test "migrations directory exists" "test -d migrations"
run_test "001_initial_schema.sql exists" "test -f migrations/001_initial_schema.sql"
run_test "002_cleanup_functions.sql exists" "test -f migrations/002_cleanup_functions.sql"
run_test "003_analytics_schema.sql exists" "test -f migrations/003_analytics_schema.sql"

# 🔟 Check tests
echo -e "\n${BLUE}🔟 Checking Tests...${NC}"
run_test "tests directory exists" "test -d tests"
run_test "vitest runs successfully" "npx vitest run"

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
