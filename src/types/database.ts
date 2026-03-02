// Database model interfaces derived from SQL migrations

export interface User {
  id: number;
  discord_id: string;
  username: string | null;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: number;
  user_id: number;
  user_message: string;
  ai_response: string;
  timestamp: Date;
}

export interface RateLimit {
  id: number;
  user_id: number;
  request_timestamps: number[];
  updated_at: Date;
}

export interface Warning {
  id: number;
  user_id: number;
  reason: string;
  issued_by: string;
  issued_at: Date;
  expires_at: Date;
  // Joined fields
  username?: string;
  user_discord_id?: string;
  issued_by_username?: string;
}

export interface MessageStat {
  id: number;
  user_id: number;
  message_type: string;
  mode: string;
  response_time_ms: number;
  tokens_estimated: number;
  created_at: Date;
}

export interface CommandUsage {
  id: number;
  user_id: number;
  command_name: string;
  is_admin_command: boolean;
  success: boolean;
  executed_at: Date;
  error_message?: string;
}

// Result types from DB functions

export interface GlobalStats {
  total_messages: string;
  unique_users: string;
  avg_response_time_ms: string;
  messages_by_type?: Record<string, number>;
  top_users?: Array<{ count: number; userId: string; username: string }>;
  peak_hours?: Record<string, number>;
  top_commands?: Array<{ count: number; command: string }>;
}

export interface UserStats {
  total_messages: string;
  avg_response_time_ms: string;
  first_message: Date;
  last_message: Date;
}

export interface UserContext {
  user_message: string;
  ai_response: string;
  timestamp: Date;
}

export interface ConversationStats {
  total_messages: number;
  unique_users: number;
  last_message: Date;
  messages_last_hour: number;
}

export interface RateLimitStats {
  total_limited_users: number;
  active_last_5min: number;
}

export interface WarningStats {
  total_warnings: number;
  active_warnings: number;
  users_with_warnings: number;
  warnings_last_week: number;
}

export interface CommandPopularity {
  command_name: string;
  usage_count: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  current: number;
}
