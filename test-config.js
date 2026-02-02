#!/usr/bin/env node

// Quick test file to validate bot configuration
require('dotenv').config();

const config = require('./src/config/config');
const logger = require('./src/utils/logger');

console.log('\n📋 Discord AI Assistant Bot - Configuration Check\n');

// Check if we're in a CI environment or if .env file is missing
const isCI = process.env.CI === 'true';
const hasEnvFile = require('fs').existsSync('.env');

if (isCI || !hasEnvFile) {
  console.log('ℹ️  CI environment or .env file not present - checking if .env.example exists');
  if (require('fs').existsSync('.env.example')) {
    console.log('✅ .env.example file exists');
    // Check if .env.example has all required fields
    const envExampleContent = require('fs').readFileSync('.env.example', 'utf8');
    const requiredFields = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_SERVER_ID', 'N8N_WORKFLOW_URL'];
    const missingFields = [];
    
    requiredFields.forEach(field => {
      if (!envExampleContent.includes(field)) {
        missingFields.push(field);
      }
    });
    
    if (missingFields.length === 0) {
      console.log('✅ .env.example contains all required fields');
      console.log('');
      console.log('📝 Note: To run the bot, create a .env file based on .env.example');
      console.log('');
    } else {
      console.log(`❌ .env.example missing required fields: ${missingFields.join(', ')}`);
      process.exit(1);
    }
  } else {
    console.log('❌ .env.example file not found');
    process.exit(1);
  }
} else {
  // Check actual configuration when .env file is present
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
}
