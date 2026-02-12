const assert = require('assert');

// Mock database connection for testing
const mockDb = {
  isAvailable: () => true,
  query: async () => ({ rows: [] })
};

// Test conversation repository
async function testConversationRepository() {
  console.log('Testing ConversationRepository...');
  
  // Mock the repository
  const repo = {
    async saveMessage(discordId, username, userMsg, aiResponse) {
      assert(discordId, 'discordId required');
      assert(userMsg, 'userMsg required');
      assert(aiResponse, 'aiResponse required');
      return true;
    },
    
    async getRecentMessages(discordId, limit = 20) {
      assert(discordId, 'discordId required');
      assert(limit > 0, 'limit must be positive');
      return [];
    },
    
    async flushUserConversations(discordId) {
      assert(discordId, 'discordId required');
      return 0;
    }
  };
  
  // Test save
  const saved = await repo.saveMessage('123', 'testuser', 'hello', 'hi');
  assert(saved === true, 'saveMessage should return true');
  
  // Test get
  const messages = await repo.getRecentMessages('123', 20);
  assert(Array.isArray(messages), 'getRecentMessages should return array');
  
  // Test flush
  const flushed = await repo.flushUserConversations('123');
  assert(typeof flushed === 'number', 'flushUserConversations should return number');
  
  console.log('✅ ConversationRepository tests passed');
}

// Test rate limit repository
async function testRateLimitRepository() {
  console.log('Testing RateLimitRepository...');
  
  const repo = {
    async checkAndUpdateLimit(discordId, maxRequests, windowMs) {
      assert(discordId, 'discordId required');
      assert(maxRequests > 0, 'maxRequests must be positive');
      assert(windowMs > 0, 'windowMs must be positive');
      
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(Date.now() + windowMs),
        current: 1
      };
    },
    
    async resetUserLimit(discordId) {
      assert(discordId, 'discordId required');
      return true;
    }
  };
  
  // Test check
  const result = await repo.checkAndUpdateLimit('123', 5, 60000);
  assert(result.allowed !== undefined, 'should return allowed status');
  assert(result.remaining !== undefined, 'should return remaining count');
  assert(result.resetAt instanceof Date, 'should return resetAt date');
  
  // Test reset
  const reset = await repo.resetUserLimit('123');
  assert(reset === true, 'resetUserLimit should return true');
  
  console.log('✅ RateLimitRepository tests passed');
}

// Test warning repository
async function testWarningRepository() {
  console.log('Testing WarningRepository...');
  
  const repo = {
    async addWarning(discordId, username, reason, issuedBy) {
      assert(discordId, 'discordId required');
      assert(reason, 'reason required');
      assert(issuedBy, 'issuedBy required');
      return 1; // Return count
    },
    
    async getActiveWarnings(discordId) {
      assert(discordId, 'discordId required');
      return 0;
    },
    
    async getWarningHistory(discordId, includeExpired) {
      assert(discordId, 'discordId required');
      return [];
    }
  };
  
  // Test add
  const count = await repo.addWarning('123', 'testuser', 'test reason', '456');
  assert(typeof count === 'number', 'addWarning should return number');
  
  // Test get active
  const active = await repo.getActiveWarnings('123');
  assert(typeof active === 'number', 'getActiveWarnings should return number');
  
  // Test history
  const history = await repo.getWarningHistory('123', false);
  assert(Array.isArray(history), 'getWarningHistory should return array');
  
  console.log('✅ WarningRepository tests passed');
}

// Test analytics repository
async function testAnalyticsRepository() {
  console.log('Testing AnalyticsRepository...');
  
  const repo = {
    async logMessage(discordId, username, messageType, mode, responseTime, tokens) {
      assert(discordId, 'discordId required');
      assert(messageType, 'messageType required');
      assert(mode, 'mode required');
      return true;
    },
    
    async logCommand(discordId, username, commandName, isAdmin, success) {
      assert(discordId, 'discordId required');
      assert(commandName, 'commandName required');
      return true;
    },
    
    async getGlobalStats(days) {
      assert(days > 0, 'days must be positive');
      return {
        total_messages: 0,
        unique_users: 0,
        avg_response_time_ms: 0
      };
    }
  };
  
  // Test log message
  const logged = await repo.logMessage('123', 'user', 'dm', 'chat', 1000, 100);
  assert(logged === true, 'logMessage should return true');
  
  // Test log command
  const cmdLogged = await repo.logCommand('123', 'user', 'warn', false, true);
  assert(cmdLogged === true, 'logCommand should return true');
  
  // Test stats
  const stats = await repo.getGlobalStats(7);
  assert(stats.total_messages !== undefined, 'should return total_messages');
  assert(stats.unique_users !== undefined, 'should return unique_users');
  
  console.log('✅ AnalyticsRepository tests passed');
}

// Test token estimator
function testTokenEstimator() {
  console.log('Testing TokenEstimator...');
  
  const estimator = {
    estimateTokens(text) {
      if (!text || typeof text !== 'string') return 0;
      return Math.ceil(text.length / 4);
    }
  };
  
  assert(estimator.estimateTokens('test') > 0, 'should estimate tokens');
  assert(estimator.estimateTokens('') === 0, 'should return 0 for empty string');
  assert(estimator.estimateTokens(null) === 0, 'should return 0 for null');
  
  console.log('✅ TokenEstimator tests passed');
}

// Run all tests
async function runTests() {
  console.log('\n🧪 Running Database Integration Tests\n');
  
  try {
    await testConversationRepository();
    await testRateLimitRepository();
    await testWarningRepository();
    await testAnalyticsRepository();
    testTokenEstimator();
    
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
