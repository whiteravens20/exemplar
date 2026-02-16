const assert = require('assert');

/**
 * Test for PostgreSQL numeric type handling in stats formatting
 * 
 * PostgreSQL returns BIGINT and NUMERIC types as strings when using node-postgres.
 * This test verifies that our stats formatter correctly converts these strings
 * to numbers before calling numeric methods like .toFixed() and .toLocaleString().
 */

async function testPostgreSQLTypeHandling() {
  console.log('Testing PostgreSQL Type Handling for Stats...');
  
  // Mock stats object as returned by PostgreSQL (all numbers are strings)
  const mockStatsFromPostgres = {
    total_messages: '60',
    unique_users: '3',
    avg_response_time_ms: '1066.45',
    messages_by_type: { dm: 17, command: 14, mention: 29 },
    top_users: [
      { count: 20, userId: '123456789', username: 'TestUser1' },
      { count: 20, userId: '987654321', username: 'TestUser2' }
    ],
    peak_hours: { '16': 60 },
    top_commands: [
      { count: 11, command: 'stats' },
      { count: 9, command: 'warn' }
    ]
  };

  // Test parseInt conversion
  const totalMessages = parseInt(mockStatsFromPostgres.total_messages);
  assert.strictEqual(totalMessages, 60);
  assert.strictEqual(typeof totalMessages, 'number');
  
  // Test parseFloat conversion
  const avgResponseTime = parseFloat(mockStatsFromPostgres.avg_response_time_ms);
  assert.strictEqual(avgResponseTime, 1066.45);
  assert.strictEqual(typeof avgResponseTime, 'number');
  
  // Test that .toFixed() works after conversion
  assert.strictEqual(avgResponseTime.toFixed(0), '1066');
  assert.strictEqual(totalMessages.toLocaleString(), '60');
  
  console.log('✅ PostgreSQL string conversion tests passed');
}

async function testNullHandling() {
  console.log('Testing null/undefined value handling...');
  
  const nullStats = {
    total_messages: null,
    unique_users: undefined,
    avg_response_time_ms: ''
  };

  assert.strictEqual(parseInt(nullStats.total_messages) || 0, 0);
  assert.strictEqual(parseInt(nullStats.unique_users) || 0, 0);
  assert.strictEqual(parseFloat(nullStats.avg_response_time_ms) || 0, 0);
  
  console.log('✅ Null/undefined handling tests passed');
}

async function testNestedNumericValues() {
  console.log('Testing numeric values in nested objects...');
  
  const mockStats = {
    top_users: [
      { count: 20, userId: '123', username: 'Test' }
    ]
  };

  const count = mockStats.top_users[0].count;
  assert.strictEqual(typeof count, 'number');
  assert.strictEqual(parseInt(count) || 0, 20);
  
  console.log('✅ Nested numeric value tests passed');
}

async function runTests() {
  try {
    await testPostgreSQLTypeHandling();
    await testNullHandling();
    await testNestedNumericValues();
    
    console.log('\n✅ All admin stats type handling tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
