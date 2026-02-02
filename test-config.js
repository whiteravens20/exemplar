#!/usr/bin/env node

// Quick test file to validate bot configuration
require('dotenv').config();

const config = require('./src/config/config');
const logger = require('./src/utils/logger');

console.log('\n📋 Discord AI Assistant Bot - Configuration Check\n');

if (config.validateRequiredConfig()) {
  logger.info('✅ All required configurations are present');
  console.log('✅ Configuration validated successfully!\n');
  
  console.log('📊 Current Configuration:');
  console.log('   Discord Server ID:', config.config.discord.serverId);
  console.log('   n8n Workflow URL:', config.config.n8n.workflowUrl);
  console.log('   Allowed Roles:', config.getAllowedRoles().length > 0 
    ? config.getAllowedRoles().join(', ') 
    : 'None (everyone has access)');
  console.log('   Mention Response:', config.config.bot.mentionResponse);
  console.log('');
} else {
  logger.error('❌ Configuration validation failed. Check .env file.');
  console.log('❌ Please ensure all required variables are set in .env\n');
  process.exit(1);
}
