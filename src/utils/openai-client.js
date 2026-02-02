const axios = require('axios');
const logger = require('./logger');

class OpenAIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async generateResponse(userMessage, conversationHistory = []) {
    try {
      if (!this.apiKey) {
        logger.warn('OpenAI API key not configured');
        return null;
      }

      const messages = [
        {
          role: 'system',
          content: 'You are a helpful Discord AI Assistant. Keep responses concise and friendly. Maximum 2000 characters.'
        },
        ...conversationHistory,
        {
          role: 'user',
          content: userMessage
        }
      ];

      logger.info('Sending request to OpenAI', { 
        messageCount: messages.length 
      });

      const response = await this.client.post('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      });

      const assistantMessage = response.data.choices[0].message.content;

      logger.info('✅ OpenAI response received', {
        tokensUsed: response.data.usage.total_tokens
      });

      return assistantMessage;
    } catch (error) {
      logger.error('❌ OpenAI API error', {
        error: error.message,
        status: error.response?.status
      });
      return null;
    }
  }

  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = OpenAIClient;
