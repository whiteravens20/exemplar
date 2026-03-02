import axios, { type AxiosInstance, type AxiosError } from 'axios';
import logger from './logger.js';
import type {
  N8NClientOptions,
  N8NWebhookPayload,
  N8NWorkflowResult,
  N8NHealthCheckResult,
  ConversationContextRow,
} from '../types/n8n.js';

class N8NClient {
  private workflowUrl: string;
  private apiKey: string;
  private maxRetries: number;
  private retryDelay: number;
  private client: AxiosInstance;

  constructor(
    workflowUrl: string,
    apiKey: string = '',
    options: N8NClientOptions = {}
  ) {
    this.workflowUrl = workflowUrl;
    this.apiKey = apiKey;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;

    this.client = axios.create({
      timeout: options.timeout ?? 120000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (apiKey) {
      this.client.defaults.headers['X-API-Key'] = apiKey;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRetryableError(error: AxiosError): boolean {
    if (!error.response) {
      return true;
    }

    const status = error.response.status;
    return status >= 500 || status === 429;
  }

  async triggerWorkflow(
    data: N8NWebhookPayload,
    retryCount: number = 0
  ): Promise<N8NWorkflowResult> {
    try {
      logger.info('Triggering n8n workflow', {
        attempt: retryCount + 1,
        maxRetries: this.maxRetries,
        dataSize: JSON.stringify(data).length,
      });

      const response = await this.client.post(this.workflowUrl, data);

      logger.info('✅ Workflow triggered successfully', {
        status: response.status,
        hasData: !!response.data,
        dataType: typeof response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        hasResponseField: response.data?.response !== undefined,
      });

      logger.debug('n8n response data:', {
        data: JSON.stringify(response.data).substring(0, 200),
      });

      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const isRetryable = this.isRetryableError(axiosError);
      const canRetry = retryCount < this.maxRetries && isRetryable;

      logger.error('❌ Error triggering workflow', {
        error: axiosError.message,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        url: this.workflowUrl,
        attempt: retryCount + 1,
        isRetryable,
        willRetry: canRetry,
      });

      if (canRetry) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        logger.info(`Retrying in ${delay}ms...`, { attempt: retryCount + 2 });

        await this.sleep(delay);
        return this.triggerWorkflow(data, retryCount + 1);
      }

      return {
        success: false,
        error: axiosError.message,
        status: axiosError.response?.status,
        isRetryable,
      };
    }
  }

  async sendMessage(
    userId: string,
    userName: string,
    message: string,
    serverId: string,
    mode: string = 'chat',
    conversationContext: ConversationContextRow[] | null = null
  ): Promise<N8NWorkflowResult> {
    if (!userId || !userName || !message) {
      logger.error('Invalid input to sendMessage', {
        userId,
        userName,
        messagePresent: !!message,
      });
      return {
        success: false,
        error: 'Invalid input parameters',
      };
    }

    const payload: N8NWebhookPayload = {
      userId,
      userName,
      message,
      serverId,
      mode,
      timestamp: new Date().toISOString(),
      platform: 'discord',
    };

    if (
      conversationContext &&
      Array.isArray(conversationContext) &&
      conversationContext.length > 0
    ) {
      payload.conversationContext = conversationContext.map((msg) => ({
        userMessage: msg.user_message,
        aiResponse: msg.ai_response,
        timestamp: msg.timestamp,
      }));

      logger.debug('Added conversation context to payload', {
        contextMessages: conversationContext.length,
      });
    }

    return this.triggerWorkflow(payload);
  }

  isConfigured(): boolean {
    return !!this.workflowUrl;
  }

  async healthCheck(): Promise<N8NHealthCheckResult> {
    try {
      const response = await this.client.get(this.workflowUrl, {
        timeout: 5000,
      });
      return { healthy: true, status: response.status };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        healthy: false,
        error: axiosError.message,
        status: axiosError.response?.status,
      };
    }
  }
}

export default N8NClient;
