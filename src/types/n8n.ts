import type { UserContext } from './database.js';

export interface N8NWebhookPayload {
  userId: string;
  userName: string;
  message: string;
  serverId: string;
  mode: string;
  timestamp: string;
  platform: string;
  conversationContext?: Array<{
    userMessage: string;
    aiResponse: string;
    timestamp: string;
  }>;
}

export interface N8NWebhookResponse {
  response: string;
  [key: string]: unknown;
}

export interface N8NWorkflowResult {
  success: boolean;
  data?: N8NWebhookResponse;
  error?: string;
  status?: number;
  isRetryable?: boolean;
}

export interface N8NClientOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface N8NHealthCheckResult {
  healthy: boolean;
  status?: number;
  error?: string;
}

export type ConversationContextRow = Pick<UserContext, 'user_message' | 'ai_response'> & {
  timestamp: Date;
};
