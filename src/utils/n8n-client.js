const axios = require('axios');
const logger = require('./logger');

class N8NClient {
  constructor(workflowUrl, apiKey = '') {
    this.workflowUrl = workflowUrl;
    this.apiKey = apiKey;
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (apiKey) {
      this.client.defaults.headers['X-API-Key'] = apiKey;
    }
  }

  async triggerWorkflow(data) {
    try {
      logger.info('Triggering n8n workflow', { data });
      
      const response = await this.client.post(this.workflowUrl, data);

      logger.info('✅ Workflow triggered successfully', { 
        status: response.status,
        hasData: !!response.data 
      });

      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      logger.error('❌ Error triggering workflow', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: this.workflowUrl
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  async sendMessage(userId, userName, message, serverId) {
    const payload = {
      userId,
      userName,
      message,
      serverId,
      timestamp: new Date().toISOString(),
      platform: 'discord'
    };

    return this.triggerWorkflow(payload);
  }

  isConfigured() {
    return !!this.workflowUrl;
  }
}

module.exports = N8NClient;
