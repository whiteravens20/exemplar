#!/usr/bin/env node

// Quick test file to validate bot configuration
const fs = require('fs');
const path = require('path');

console.log('\n📋 Discord AI Assistant Bot - Configuration Check\n');

// Check if .env file exists
const envFilePath = path.resolve(__dirname, '.env');
const envExamplePath = path.resolve(__dirname, '.env.example');

if (!fs.existsSync(envFilePath)) {
  console.log('ℹ️  .env file not found');
  
  // Check if .env.example exists
  if (!fs.existsSync(envExamplePath)) {
    console.log('❌ .env.example file not found');
    console.log('📝 Note: Please create a .env file with the required configuration');
    process.exit(1);
  }
  
  console.log('✅ .env.example file exists');
  
  // Copy .env.example to .env
  console.log('📄 Creating .env file from .env.example');
  try {
    fs.copyFileSync(envExamplePath, envFilePath);
    console.log('✅ .env file created successfully');
  } catch (error) {
    console.log(`❌ Failed to create .env file: ${error.message}`);
    process.exit(1);
  }
} else {
  console.log('✅ .env file exists');
}

// Now load the configuration
require('dotenv').config();
const config = require('./src/config/config');
const logger = require('./src/utils/logger');

// Validate configuration
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
