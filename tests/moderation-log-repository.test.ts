import { describe, it, expect } from 'vitest';
import {
  buildLogWhere,
  clampLimit,
  MAX_QUERY_LIMIT,
} from '../src/db/repositories/moderation-log-repository.js';

describe('buildLogWhere', () => {
  it('returns an empty clause for no filters', () => {
    const { clause, params } = buildLogWhere({});
    expect(clause).toBe('');
    expect(params).toEqual([]);
  });

  it('builds sequential placeholders for each filter', () => {
    const from = new Date('2025-01-01T00:00:00Z');
    const to = new Date('2025-02-01T00:00:00Z');
    const { clause, params } = buildLogWhere({
      from,
      to,
      targetUserId: '111',
      channelId: '222',
      actorType: 'ai',
      eventType: 'ban',
      severity: 'high',
    });
    expect(clause).toBe(
      'WHERE created_at >= $1 AND created_at <= $2 AND target_user_id = $3 ' +
        'AND channel_id = $4 AND actor_type = $5 AND event_type = $6 AND severity = $7'
    );
    expect(params).toEqual([from, to, '111', '222', 'ai', 'ban', 'high']);
  });

  it('wraps a search term in wildcards bound as a single parameter', () => {
    const { clause, params } = buildLogWhere({ search: 'spam' });
    expect(clause).toContain('reason ILIKE $1');
    expect(clause).toContain('ai_reasoning ILIKE $1');
    expect(clause).toContain('target_username ILIKE $1');
    expect(clause).toContain('actor_label ILIKE $1');
    expect(params).toEqual(['%spam%']);
  });

  it('does not interpolate values into the SQL string (injection safety)', () => {
    const { clause, params } = buildLogWhere({
      targetUserId: "1; DROP TABLE moderation_logs;--",
    });
    expect(clause).toBe('WHERE target_user_id = $1');
    expect(params).toEqual(["1; DROP TABLE moderation_logs;--"]);
  });
});

describe('clampLimit', () => {
  it('defaults when undefined', () => {
    expect(clampLimit(undefined)).toBe(50);
  });
  it('caps at the maximum', () => {
    expect(clampLimit(99999)).toBe(MAX_QUERY_LIMIT);
  });
  it('floors at 1', () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
  });
  it('passes through a valid value', () => {
    expect(clampLimit(75)).toBe(75);
  });
});
