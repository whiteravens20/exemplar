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

// ── Dashboard moderation event log (issue #18, migration 005) ────────────────

export type ModerationEventType =
  | 'warn'
  | 'ban'
  | 'kick'
  | 'mute'
  | 'unmute'
  | 'unban'
  | 'delete'
  | 'ai_flag'
  // Reserved for the User Feedback & Rating System (issue #17).
  | 'feedback';

export type ModerationSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type ModerationActorType = 'human' | 'ai' | 'system';

/** Shape inserted into `moderation_logs` via {@link ModerationLogRepository.record}. */
export interface ModerationLogEntry {
  guildId?: string | null;
  eventType: ModerationEventType;
  severity?: ModerationSeverity;
  actorType?: ModerationActorType;
  actorId?: string | null;
  actorLabel?: string | null;
  targetUserId?: string | null;
  targetUsername?: string | null;
  channelId?: string | null;
  action?: string | null;
  reason?: string | null;
  aiReasoning?: string | null;
  aiRule?: string | null;
  metadata?: Record<string, unknown>;
}

/** Row shape as returned from `moderation_logs`. */
export interface ModerationLogRow {
  id: string;
  guild_id: string | null;
  event_type: string;
  severity: string;
  actor_type: string;
  actor_id: string | null;
  actor_label: string | null;
  target_user_id: string | null;
  target_username: string | null;
  channel_id: string | null;
  action: string | null;
  reason: string | null;
  ai_reasoning: string | null;
  ai_rule: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

/** Filter set accepted by {@link ModerationLogRepository.query}. */
export interface ModerationLogFilters {
  from?: Date;
  to?: Date;
  targetUserId?: string;
  channelId?: string;
  actorType?: ModerationActorType;
  eventType?: ModerationEventType;
  severity?: ModerationSeverity;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ModerationLogPage {
  rows: ModerationLogRow[];
  total: number;
}

export interface ModerationLogStats {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byActorType: Record<string, number>;
  daily: Array<{ day: string; count: number }>;
  topTargets: Array<{ userId: string; username: string | null; count: number }>;
}

// ── Reaction roles (issue #24, migration 006) ────────────────────────────────

/** Row shape as returned from `reaction_roles`. */
export interface ReactionRoleRow {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  emoji_key: string;
  emoji_display: string;
  /** Role granted by the reaction; null for a command binding. */
  role_id: string | null;
  /** Command whose reply is DMed to the reacting member; null for a role binding. */
  command: string | null;
  created_by: string;
  created_at: Date;
}

/** Shape inserted into `reaction_roles`. */
export type ReactionRoleInput = Omit<ReactionRoleRow, 'id' | 'created_at'>;

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  current: number;
}
