import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import type { Server } from 'node:http';
import type { Client } from 'discord.js';
import logger from '../../utils/logger.js';
import configManager from '../../config/config.js';
import moderationLogRepo from '../../db/repositories/moderation-log-repository.js';
import warningRepo from '../../db/repositories/warning-repository.js';
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchUser,
} from './oauth.js';
import {
  signSession,
  verifySession,
  signState,
  verifyState,
  type SessionPayload,
} from './session.js';
import { resolveAccess, type AccessResult } from './rbac.js';
import {
  appendSetCookie,
  asActorType,
  asBoundedInt,
  asDate,
  asEventType,
  asSearch,
  asSeverity,
  createRateLimiter,
  isSnowflake,
  parseCookies,
  randomNonce,
  securityHeaders,
  serializeCookie,
} from './http-helpers.js';

const SESSION_COOKIE = 'dash_session';
const STATE_COOKIE = 'dash_state';
const ACCESS_CACHE_TTL_MS = 60 * 1000;

interface DashRequest extends Request {
  dashSession?: SessionPayload | null;
}

/**
 * The Advanced Logging Dashboard HTTP server (issue #18). Runs in the bot
 * process (so it can reuse the Discord client for RBAC and live ban/mute
 * status) but listens on its own port, separate from the k8s health server.
 * Disabled unless `DASHBOARD_ENABLED=true`.
 */
class DashboardServer {
  private app: express.Application;
  private server: Server | null = null;
  private readonly client: Client;
  private readonly publicDir: string;
  /** Short-lived cache of live RBAC decisions, keyed by user id. */
  private readonly accessCache = new Map<string, { result: AccessResult; exp: number }>();

  constructor(client: Client) {
    this.client = client;
    this.publicDir = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'public'
    );
    this.app = express();
    this.configure();
    this.routes();
  }

  private get secure(): boolean {
    return configManager.config.dashboard.cookieSecure;
  }

  private configure(): void {
    // Behind an HTTPS-terminating proxy, trust the first hop so Secure cookies
    // and req.ip behave correctly; otherwise don't trust forwarded headers.
    this.app.set('trust proxy', this.secure ? 1 : false);
    this.app.disable('x-powered-by');
    this.app.use(securityHeaders(this.secure));
    this.app.use(express.json({ limit: '16kb' }));

    // Attach the verified session (if any) to every request.
    this.app.use((req: DashRequest, _res, next) => {
      const cookies = parseCookies(req.headers.cookie);
      req.dashSession = verifySession(
        cookies[SESSION_COOKIE],
        configManager.config.dashboard.sessionSecret
      );
      next();
    });
  }

  // ── Auth middleware ──────────────────────────────────────────────────────

  private requireAuth = (
    req: DashRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.dashSession) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    next();
  };

  private requireModAccess = async (
    req: DashRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const session = req.dashSession;
    if (!session) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const access = await this.getAccess(session.userId);
    if (!access.authorized) {
      logger.warn('Dashboard access denied', { userId: session.userId });
      res.status(403).json({ error: 'You are not authorized to view this data' });
      return;
    }
    next();
  };

  /** Live RBAC decision with a short TTL cache so revoked roles take effect quickly. */
  private async getAccess(userId: string): Promise<AccessResult> {
    const cached = this.accessCache.get(userId);
    const now = Date.now();
    if (cached && cached.exp > now) return cached.result;

    const result = await resolveAccess(this.client, userId);
    this.accessCache.set(userId, { result, exp: now + ACCESS_CACHE_TTL_MS });
    return result;
  }

  // ── Routes ────────────────────────────────────────────────────────────────

  private routes(): void {
    const dash = configManager.config.dashboard;
    const discord = configManager.config.discord;

    // Throttle the auth endpoints harder than the read API.
    const authLimiter = createRateLimiter(10, 60 * 1000);
    const apiLimiter = createRateLimiter(120, 60 * 1000);

    // Begin OAuth: set a signed CSRF state and redirect to Discord.
    this.app.get('/login', authLimiter, (req: DashRequest, res) => {
      if (req.dashSession) {
        res.redirect('/');
        return;
      }
      const nonce = randomNonce();
      appendSetCookie(
        res,
        serializeCookie(STATE_COOKIE, nonce, {
          maxAgeSeconds: 600,
          secure: this.secure,
          sameSite: 'Lax',
        })
      );
      const url = buildAuthorizeUrl({
        clientId: discord.clientId,
        redirectUri: dash.oauthRedirectUri,
        state: signState(nonce, dash.sessionSecret),
      });
      res.redirect(url);
    });

    // OAuth callback: verify state, exchange code, resolve access, set session.
    this.app.get('/callback', authLimiter, async (req: DashRequest, res) => {
      try {
        const cookies = parseCookies(req.headers.cookie);
        const nonce = cookies[STATE_COOKIE];
        const state = typeof req.query.state === 'string' ? req.query.state : undefined;
        const code = typeof req.query.code === 'string' ? req.query.code : undefined;

        // Clear the one-time state cookie regardless of outcome.
        appendSetCookie(
          res,
          serializeCookie(STATE_COOKIE, '', { maxAgeSeconds: 0, secure: this.secure })
        );

        if (!verifyState(state, nonce, dash.sessionSecret)) {
          res.status(400).send('Invalid or expired login request. Please try again.');
          return;
        }
        if (!code) {
          res.status(400).send('Missing authorization code.');
          return;
        }

        const accessToken = await exchangeCode({
          code,
          clientId: discord.clientId,
          clientSecret: dash.oauthClientSecret,
          redirectUri: dash.oauthRedirectUri,
        });
        if (!accessToken) {
          res.status(401).send('Discord authentication failed.');
          return;
        }

        const user = await fetchUser(accessToken);
        if (!user) {
          res.status(401).send('Could not load your Discord profile.');
          return;
        }

        const access = await this.getAccess(user.id);
        const token = signSession(
          {
            userId: user.id,
            username: user.global_name || user.username,
            authorized: access.authorized,
            isAdmin: access.isAdmin,
          },
          dash.sessionSecret,
          dash.sessionTtlSeconds
        );
        appendSetCookie(
          res,
          serializeCookie(SESSION_COOKIE, token, {
            maxAgeSeconds: dash.sessionTtlSeconds,
            secure: this.secure,
            sameSite: 'Lax',
          })
        );

        logger.info('Dashboard login', {
          userId: user.id,
          authorized: access.authorized,
        });
        res.redirect('/');
      } catch (error) {
        logger.error('Dashboard callback error', {
          error: (error as Error).message,
        });
        res.status(500).send('Login failed.');
      }
    });

    this.app.post('/logout', (req: DashRequest, res) => {
      appendSetCookie(
        res,
        serializeCookie(SESSION_COOKIE, '', { maxAgeSeconds: 0, secure: this.secure })
      );
      if (req.dashSession) {
        this.accessCache.delete(req.dashSession.userId);
      }
      res.status(204).end();
    });

    // Current session — drives the login/denied/authorized UI states.
    this.app.get('/api/me', this.requireAuth, (req: DashRequest, res) => {
      const s = req.dashSession;
      if (!s) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      res.json({
        userId: s.userId,
        username: s.username,
        authorized: s.authorized,
        isAdmin: s.isAdmin,
      });
    });

    // Everything below requires live mod access.
    this.app.use('/api', apiLimiter);

    this.app.get('/api/logs', this.requireModAccess, async (req, res) => {
      const q = req.query;
      const page = await moderationLogRepo.query({
        from: asDate(q.from),
        to: asDate(q.to),
        targetUserId: isSnowflake(q.userId) ? q.userId : undefined,
        channelId: isSnowflake(q.channelId) ? q.channelId : undefined,
        actorType: asActorType(q.actorType),
        eventType: asEventType(q.eventType),
        severity: asSeverity(q.severity),
        search: asSearch(q.search),
        limit: asBoundedInt(q.limit, 50, 1, 200),
        offset: asBoundedInt(q.offset, 0, 0, 1_000_000),
      });
      res.json(page);
    });

    this.app.get('/api/logs/:id', this.requireModAccess, async (req, res) => {
      const id = String(req.params.id);
      if (!/^\d+$/.test(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      const row = await moderationLogRepo.getById(id);
      if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json(row);
    });

    this.app.get('/api/stats', this.requireModAccess, async (req, res) => {
      const days = asBoundedInt(req.query.days, 7, 1, 90);
      res.json(await moderationLogRepo.getStats(days));
    });

    // Per-user profile: active warnings + live ban/mute status + event history.
    this.app.get('/api/users/:userId', this.requireModAccess, async (req, res) => {
      const userId = req.params.userId;
      if (!isSnowflake(userId)) {
        res.status(400).json({ error: 'Invalid user id' });
        return;
      }
      res.json(await this.buildUserProfile(userId));
    });

    // Reserved for the User Feedback & Rating System (issue #17). Returns an
    // empty feed today so the "Users feedback" view renders cleanly; #17 will
    // replace this with real rating/comment data.
    this.app.get('/api/feedback', this.requireModAccess, (_req, res) => {
      res.json({ items: [], notImplemented: true });
    });

    this.app.get('/api/config', this.requireModAccess, (_req, res) => {
      res.json(this.redactedConfig());
    });

    // Static SPA last so it can't shadow the API/auth routes.
    this.app.use(express.static(this.publicDir, { index: 'index.html' }));

    this.app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async buildUserProfile(userId: string): Promise<unknown> {
    const guild = this.client.guilds.cache.get(
      configManager.config.discord.serverId
    );

    let banned = false;
    let banReason: string | null = null;
    let muted = false;
    let mutedUntil: string | null = null;
    let username: string | null = null;

    if (guild) {
      const ban = await guild.bans.fetch(userId).catch(() => null);
      if (ban) {
        banned = true;
        banReason = ban.reason ?? null;
        username = ban.user.tag;
      }
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        username = member.user.tag;
        const until = member.communicationDisabledUntilTimestamp;
        if (until && until > Date.now()) {
          muted = true;
          mutedUntil = new Date(until).toISOString();
        }
      }
    }

    const [activeWarnings, history, events] = await Promise.all([
      warningRepo.getActiveWarnings(userId),
      warningRepo.getWarningHistory(userId, false),
      moderationLogRepo.query({ targetUserId: userId, limit: 50 }),
    ]);

    return {
      userId,
      username,
      banned,
      banReason,
      muted,
      mutedUntil,
      activeWarnings,
      warnings: history.map((w) => ({
        reason: w.reason,
        issuedAt: w.issued_at,
        expiresAt: w.expires_at,
        issuedBy: w.issued_by,
      })),
      recentEvents: events.rows,
    };
  }

  /** Allowlisted, secret-free view of the effective config. */
  private redactedConfig(): unknown {
    const c = configManager.config;
    return {
      moderation: {
        aiMode: c.moderation.aiMode,
        aiModerationConfigured: c.moderation.aiModerationUrl.length > 0,
        warnMuteThreshold: c.moderation.warnMuteThreshold,
        warnBanThreshold: c.moderation.warnBanThreshold,
        userCooldownMs: c.moderation.userCooldownMs,
        includeChannels: c.moderation.includeChannels,
        exemptRoles: c.moderation.exemptRoles,
        allowedRoles: c.moderation.allowedRoles,
        modLogChannelId: c.moderation.modLogChannelId ?? null,
        rulesConfigured: c.moderation.rulesText.length > 0,
      },
      dashboard: {
        allowedRoles: c.dashboard.allowedRoles,
        cookieSecure: c.dashboard.cookieSecure,
        sessionTtlSeconds: c.dashboard.sessionTtlSeconds,
      },
      logging: { level: c.logging.level },
      database: {
        name: c.database.name,
        ssl: c.database.ssl,
        maxConnections: c.database.maxConnections,
      },
    };
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(): Promise<void> {
    const port = configManager.config.dashboard.port;
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, () => {
        logger.info('Dashboard server started', {
          port,
          url: configManager.config.dashboard.publicBaseUrl,
        });
        resolve();
      });
      this.server.on('error', (error: Error) => {
        logger.error('Dashboard server error', { error: error.message });
        reject(error);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Dashboard server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default DashboardServer;
