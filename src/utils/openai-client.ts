import axios, { type AxiosInstance, type AxiosError } from 'axios';
import logger from './logger.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class OpenAIClient {
  private apiKey: string;
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async generateResponse(
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<string | null> {
    try {
      if (!this.apiKey) {
        logger.warn('OpenAI API key not configured');
        return null;
      }

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You are a helpful Discord AI Assistant. Keep responses concise and friendly. Maximum 2000 characters.',
        },
        ...conversationHistory,
        {
          role: 'user',
          content: userMessage,
        },
      ];

      logger.info('Sending request to OpenAI', {
        messageCount: messages.length,
      });

      const response = await this.client.post('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      });

      const assistantMessage: string =
        response.data.choices[0].message.content;

      logger.info('✅ OpenAI response received', {
        tokensUsed: response.data.usage.total_tokens,
      });

      return assistantMessage;
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error('❌ OpenAI API error', {
        error: axiosError.message,
        status: axiosError.response?.status,
      });
      return null;
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export default OpenAIClient;
