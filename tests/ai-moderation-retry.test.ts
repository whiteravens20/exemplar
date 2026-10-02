import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChannelType } from 'discord.js';

const triggerWorkflow = vi.fn();
const clientOptions: unknown[] = [];

vi.mock('../src/utils/n8n-client.js', () => ({
  default: class {
    constructor(_url: string, _apiKey: string, options: unknown) {
      clientOptions.push(options);
    }
    triggerWorkflow = triggerWorkflow;
  },
}));

vi.mock('../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../src/db/repositories/warning-repository.js', () => ({
  default: { getRecentWarningSummaries: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../src/db/repositories/moderation-log-repository.js', () => ({
  default: { record: vi.fn().mockResolvedValue(undefined) },
}));

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const failed = { success: false, error: 'timeout of 300000ms exceeded' };
const verdict = (action: string, extra: Record<string, unknown> = {}) => ({
  success: true,
  data: { verdict: { action, ...extra } },
});

let analyzeAndAct: (message: never) => Promise<void>;
let t: (key: string, options?: Record<string, unknown>) => string;
let modLogSend: ReturnType<typeof vi.fn>;

function makeMessage(id: string, channelId = 'chan-1'): never {
  const modLog = { type: ChannelType.GuildText, send: modLogSend };
  return {
    id,
    author: { bot: false, id: `user-${id}`, username: 'alice', tag: 'alice' },
    system: false,
    content: 'hello world',
    channel: { type: ChannelType.GuildText, name: 'general' },
    channelId,
    guild: { id: 'guild-1', channels: { cache: new Map([['modlog-1', modLog]]) } },
    member: { roles: { cache: new Map() } },
    client: { user: { id: 'bot-1' } },
  } as never;
}

/** The embeds posted to the mod-log so far, as plain data. */
const posted = () => modLogSend.mock.calls.map((call) => call[0].embeds[0].data);

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  triggerWorkflow.mockReset();
  clientOptions.length = 0;
  modLogSend = vi.fn().mockResolvedValue(undefined);

  const config = (await import('../src/config/config.js')).default;
  Object.assign(config.config.moderation, {
    aiMode: 'shadow',
    aiModerationUrl: 'http://n8n.test/webhook/moderation',
    includeChannels: ['chan-1', 'chan-2'],
    exemptRoles: [],
    maxConcurrent: 2,
    modLogChannelId: 'modlog-1',
  });
  ({ t } = await import('../src/utils/i18n.js'));
  ({ analyzeAndAct } = (await import('../src/utils/ai-moderation.js')) as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AI moderation when the workflow does not answer', () => {
  it('waits five minutes for a verdict', async () => {
    triggerWorkflow.mockResolvedValue(verdict('allow'));
    await analyzeAndAct(makeMessage('1'));
    expect(clientOptions).toEqual([{ timeout: 5 * MINUTE }]);
  });

  it('tries a failed request again after a pause and acts on its verdict', async () => {
    triggerWorkflow
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(verdict('warn', { reason: 'insult' }));
    const done = analyzeAndAct(makeMessage('1'));

    await vi.advanceTimersByTimeAsync(29 * SECOND);
    expect(triggerWorkflow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(SECOND);
    await done;

    expect(triggerWorkflow).toHaveBeenCalledTimes(2);
    expect(posted().map((embed) => embed.title)).toEqual([
      t('aiModeration.shadowTitle', { action: 'warn' }),
    ]);
  });

  it('gives up after three attempts and tells the moderators', async () => {
    triggerWorkflow.mockResolvedValue(failed);
    const done = analyzeAndAct(makeMessage('1'));

    await vi.advanceTimersByTimeAsync(30 * SECOND);
    expect(triggerWorkflow).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60 * SECOND);
    await done;
    expect(triggerWorkflow).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(0);
    const [notice] = posted();
    expect(notice.title).toBe(t('aiModeration.uncheckedTitle'));
    expect(notice.fields).toEqual([
      { name: t('aiModeration.uncheckedCount'), value: '1', inline: true },
      { name: t('moderation.fields.channel'), value: '<#chan-1>', inline: true },
      { name: t('moderation.fields.problem'), value: failed.error },
    ]);
  });

  it('reports later messages together, not one notice each', async () => {
    triggerWorkflow.mockResolvedValue(failed);
    const run = async (id: string, channelId: string) => {
      const done = analyzeAndAct(makeMessage(id, channelId));
      await vi.advanceTimersByTimeAsync(90 * SECOND);
      await done;
    };

    await run('1', 'chan-1');
    expect(posted()).toHaveLength(1);

    await run('2', 'chan-1');
    await run('3', 'chan-2');
    expect(posted()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(posted()).toHaveLength(2);
    expect(posted()[1].fields?.slice(0, 2)).toEqual([
      { name: t('aiModeration.uncheckedCount'), value: '2', inline: true },
      { name: t('moderation.fields.channel'), value: '<#chan-1> <#chan-2>', inline: true },
    ]);
  });

  it('stops retrying a message that is ten minutes old', async () => {
    // Every attempt runs into the five-minute timeout.
    triggerWorkflow.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(failed), 5 * MINUTE))
    );
    const done = analyzeAndAct(makeMessage('1'));

    await vi.advanceTimersByTimeAsync(11 * MINUTE);
    await done;

    // 5 min, 30 s pause, 5 min: a third attempt would start past the limit.
    expect(triggerWorkflow).toHaveBeenCalledTimes(2);
    expect(posted()[0].title).toBe(t('aiModeration.uncheckedTitle'));
  });

  it('does not retry a verdict it cannot read', async () => {
    triggerWorkflow.mockResolvedValue(verdict('explode'));
    await analyzeAndAct(makeMessage('1'));
    await vi.advanceTimersByTimeAsync(2 * MINUTE);

    expect(triggerWorkflow).toHaveBeenCalledTimes(1);
    expect(posted()).toEqual([]);
  });
});
