/**
 * Diagnostic tool for testing !code command
 * Tests n8n workflow response format
 */

const config = require('../src/config/config');
const N8NClient = require('../src/utils/n8n-client');

console.log('='.repeat(70));
console.log('n8n !code Command Diagnostics');
console.log('='.repeat(70));
console.log('');

// Check config
console.log('1. Configuration Check:');
console.log(`   n8n URL: ${config.config.n8n.workflowUrl}`);
console.log(`   API Key: ${config.config.n8n.apiKey ? '✓ Set' : '✗ Not set'}`);
console.log('');

// Test both modes
async function testMode(mode) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing mode: "${mode}"`);
  console.log('='.repeat(70));
  
  const n8nClient = new N8NClient(
    config.config.n8n.workflowUrl,
    config.config.n8n.apiKey
  );

  const testMessage = mode === 'code' 
    ? 'jak zbudowac kalkulator w c++?'
    : 'hello';

  console.log(`\nSending test message: "${testMessage}"`);
  console.log(`Mode: ${mode}`);
  console.log('');

  const result = await n8nClient.sendMessage(
    'test-user-123',
    'TestUser',
    testMessage,
    'test-server',
    mode
  );

  console.log('\nResult:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Status: ${result.status || 'N/A'}`);
  
  if (result.success) {
    console.log('\n  Response Data Structure:');
    console.log(`    Type: ${typeof result.data}`);
    console.log(`    Keys: ${JSON.stringify(Object.keys(result.data || {}))}`);
    console.log(`    Has 'response' field: ${result.data?.response !== undefined}`);
    
    if (result.data?.response) {
      console.log(`\n  Response Content:`);
      console.log(`    Length: ${result.data.response.length} chars`);
      console.log(`    Preview: "${result.data.response.substring(0, 150)}..."`);
      console.log('\n  ✅ SUCCESS - Response field found!');
    } else {
      console.log('\n  ❌ PROBLEM - No "response" field!');
      console.log('\n  Full data received:');
      console.log(JSON.stringify(result.data, null, 2).substring(0, 500));
    }
  } else {
    console.log(`\n  ❌ ERROR: ${result.error}`);
    console.log(`  Status Code: ${result.status || 'Network error'}`);
  }
}

async function runTests() {
  try {
    // Test chat mode
    await testMode('chat');
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test code mode
    await testMode('code');
    
    console.log('\n' + '='.repeat(70));
    console.log('Diagnostics Complete');
    console.log('='.repeat(70));
    console.log('\nIf you see different results for chat vs code mode,');
    console.log('the issue is in your n8n workflow routing logic.');
    console.log('\nCheck your n8n workflow:');
    console.log('  1. Does it have a Switch/Router node for "mode"?');
    console.log('  2. Are both branches returning { "response": "..." }?');
    console.log('  3. Is the code LLM node actually connected?');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

runTests();
