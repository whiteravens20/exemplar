const axios = require('axios');
const logger = require('./logger');

class N8NClient {
  constructor(workflowUrl, apiKey = '', options = {}) {
    this.workflowUrl = workflowUrl;
    this.apiKey = apiKey;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // ms
    
    this.client = axios.create({
      timeout: options.timeout || 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (apiKey) {
      this.client.defaults.headers['X-API-Key'] = apiKey;
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - milliseconds to sleep
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable
   * @param {Error} error - The error to check
   */
  isRetryableError(error) {
    if (!error.response) {
      // Network errors are retryable
      return true;
    }

    const status = error.response.status;
    // Retry on 5xx server errors and 429 (rate limit)
    return status >= 500 || status === 429;
  }

  async triggerWorkflow(data, retryCount = 0) {
    try {
      logger.info('Triggering n8n workflow', { 
        attempt: retryCount + 1,
        maxRetries: this.maxRetries,
        dataSize: JSON.stringify(data).length
      });
      
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
      const isRetryable = this.isRetryableError(error);
      const canRetry = retryCount < this.maxRetries && isRetryable;

      logger.error('❌ Error triggering workflow', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: this.workflowUrl,
        attempt: retryCount + 1,
        isRetryable,
        willRetry: canRetry
      });

      if (canRetry) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = this.retryDelay * Math.pow(2, retryCount);
        logger.info(`Retrying in ${delay}ms...`, { attempt: retryCount + 2 });
        
        await this.sleep(delay);
        return this.triggerWorkflow(data, retryCount + 1);
      }

      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        isRetryable
      };
    }
  }

  async sendMessage(userId, userName, message, serverId) {
    // Validate input
    if (!userId || !userName || !message) {
      logger.error('Invalid input to sendMessage', { userId, userName, messagePresent: !!message });
      return {
        success: false,
        error: 'Invalid input parameters'
      };
    }

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

  /**
   * Health check for n8n endpoint
   */
  async healthCheck() {
    try {
      const response = await this.client.get(this.workflowUrl, { timeout: 5000 });
      return { healthy: true, status: response.status };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        status: error.response?.status 
      };
    }
  }
}

module.exports = N8NClient;
