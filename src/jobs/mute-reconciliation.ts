import type { Client } from 'discord.js';
import logger from '../utils/logger.js';
import db from '../db/connection.js';
import configManager from '../config/config.js';
import warningRepo from '../db/repositories/warning-repository.js';
import aiModMuteRepo from '../db/repositories/ai-mod-mute-repository.js';
import {
  applyUntimeout,
  getConfiguredGuild,
  reconcileMuteForUser,
  type Actor,
} from '../utils/moderation-actions.js';

/**
 * Mute reconciliation job (issue #16).
 *
 * Walks rows in `ai_mod_active_mutes` periodically and:
 *   - lifts the timeout when the user's active warning count has dropped
 *     below the threshold (the "warning faded → user unmuted" rule);
 *   - re-applies the timeout if Discord's 28-day cap caused it to expire
 *     while the user still has >= threshold active warnings.
 *
 * Human-set timeouts have no row here and are never touched.
 */

const RECONCILE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
// When the recorded mute expiry is within this window, re-apply preemptively
// so the user is never temporarily unmuted between Discord's natural expiry
// and the next reconcile tick.
const EXPIRY_REFRESH_WINDOW_MS = 60 * 60 * 1000;

const RECONCILE_ACTOR_LABEL = 'AI moderation';

class MuteReconciliationJob {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private client: Client | null = null;

  start(client: Client): void {
    if (this.intervalId) {
      logger.warn('Mute reconciliation job already running');
      return;
    }
    this.client = client;

    logger.info('Starting mute reconciliation job', {
      intervalMinutes: RECONCILE_INTERVAL_MS / (60 * 1000),
    });

    // Run once on start so mutes set before a restart are immediately
    // verified, then on the recurring tick.
    void this.run();
    this.intervalId = setInterval(() => {
      void this.run();
    }, RECONCILE_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Mute reconciliation job stopped');
    }
  }

  async run(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Mute reconciliation already in progress, skipping');
      return;
    }
    if (!this.client) {
      logger.debug('Mute reconciliation: no client bound, skipping');
      return;
    }
    if (!db.isAvailable()) {
      logger.debug('Mute reconciliation: db unavailable, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const rows = await aiModMuteRepo.findAll();
      if (rows.length === 0) {
        this.isRunning = false;
        return;
      }

      const guild = getConfiguredGuild(this.client);
      if (!guild) {
        logger.warn(
          'Mute reconciliation: configured guild not found in cache'
        );
        this.isRunning = false;
        return;
      }

      const actor: Actor = {
        id: this.client.user?.id ?? '0',
        label: RECONCILE_ACTOR_LABEL,
      };

      const { warnMuteThreshold } = configManager.config.moderation;

      let unmuted = 0;
      let extended = 0;
      let skipped = 0;

      for (const row of rows) {
        try {
          const activeCount = await warningRepo.getActiveWarnings(
            row.user_discord_id
          );

          if (activeCount < warnMuteThreshold) {
            // Active count dropped below the threshold — lift the mute.
            const member = await guild.members
              .fetch(row.user_discord_id)
              .catch(() => null);
            if (member && member.communicationDisabledUntil) {
              await applyUntimeout(member, actor);
            }
            await aiModMuteRepo.delete(row.user_discord_id);
            unmuted += 1;
            continue;
          }

          // Still above threshold — refresh the mute if the current Discord
          // timeout has expired (or is about to) so the user isn't free in
          // the window between Discord's natural expiry and the next tick.
          const expiresInMs =
            new Date(row.expires_at).getTime() - Date.now();
          if (expiresInMs <= EXPIRY_REFRESH_WINDOW_MS) {
            const member = await guild.members
              .fetch(row.user_discord_id)
              .catch(() => null);
            if (!member) {
              await aiModMuteRepo.delete(row.user_discord_id);
              continue;
            }
            const result = await reconcileMuteForUser(
              guild,
              member.user,
              actor,
              activeCount
            );
            if (result?.success) extended += 1;
            else skipped += 1;
          } else {
            skipped += 1;
          }
        } catch (error) {
          logger.error('Mute reconciliation row failed', {
            userId: row.user_discord_id,
            error: (error as Error).message,
          });
        }
      }

      logger.info('Mute reconciliation completed', {
        durationMs: Date.now() - startTime,
        rows: rows.length,
        unmuted,
        extended,
        skipped,
      });
    } catch (error) {
      logger.error('Mute reconciliation failed', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    } finally {
      this.isRunning = false;
    }
  }
}

export default new MuteReconciliationJob();
