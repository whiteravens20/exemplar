import { describe, it, expect } from 'vitest';

describe('PostgreSQL Type Handling for Stats', () => {
  // Mock stats object as returned by PostgreSQL (all numbers are strings)
  const mockStatsFromPostgres = {
    total_messages: '60',
    unique_users: '3',
    avg_response_time_ms: '1066.45',
    messages_by_type: { dm: 17, command: 14, mention: 29 },
    top_users: [
      { count: 20, userId: '123456789', username: 'TestUser1' },
      { count: 20, userId: '987654321', username: 'TestUser2' },
    ],
    peak_hours: { '16': 60 },
    top_commands: [
      { count: 11, command: 'stats' },
      { count: 9, command: 'warn' },
    ],
  };

  it('should convert parseInt correctly', () => {
    const totalMessages = parseInt(mockStatsFromPostgres.total_messages);
    expect(totalMessages).toBe(60);
    expect(typeof totalMessages).toBe('number');
  });

  it('should convert parseFloat correctly', () => {
    const avgResponseTime = parseFloat(
      mockStatsFromPostgres.avg_response_time_ms
    );
    expect(avgResponseTime).toBe(1066.45);
    expect(typeof avgResponseTime).toBe('number');
  });

  it('should allow .toFixed() after conversion', () => {
    const avgResponseTime = parseFloat(
      mockStatsFromPostgres.avg_response_time_ms
    );
    expect(avgResponseTime.toFixed(0)).toBe('1066');
  });

  it('should allow .toLocaleString() after conversion', () => {
    const totalMessages = parseInt(mockStatsFromPostgres.total_messages);
    expect(totalMessages.toLocaleString()).toBe('60');
  });
});

describe('Null/Undefined Value Handling', () => {
  const nullStats = {
    total_messages: null as string | null,
    unique_users: undefined as string | undefined,
    avg_response_time_ms: '',
  };

  it('should handle null values', () => {
    expect(parseInt(nullStats.total_messages as string) || 0).toBe(0);
  });

  it('should handle undefined values', () => {
    expect(parseInt(nullStats.unique_users as string) || 0).toBe(0);
  });

  it('should handle empty string values', () => {
    expect(parseFloat(nullStats.avg_response_time_ms) || 0).toBe(0);
  });
});

describe('Nested Numeric Values', () => {
  const mockStats = {
    top_users: [{ count: 20, userId: '123', username: 'Test' }],
  };

  it('should handle numeric values in nested objects', () => {
    const count = mockStats.top_users[0].count;
    expect(typeof count).toBe('number');
    expect(parseInt(String(count)) || 0).toBe(20);
  });
});
