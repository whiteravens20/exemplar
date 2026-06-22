import { request } from 'undici';
import logger from '../../utils/logger.js';

/**
 * Minimal Discord OAuth2 client for the dashboard login flow. Only the
 * `identify` scope is requested — authorization (who may view the dashboard) is
 * decided separately from the bot's own view of the guild (see `rbac.ts`), so
 * no `guilds.*` scopes are needed.
 */

const DISCORD_API = 'https://discord.com/api';

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

/**
 * Build the Discord authorize URL. Pure (no I/O) so it can be unit-tested.
 * Uses `response_type=code` and carries the signed CSRF `state`.
 */
export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'identify',
    state: params.state,
    prompt: 'none',
  });
  return `${DISCORD_API}/oauth2/authorize?${query.toString()}`;
}

/** Exchange an authorization `code` for an access token. Returns null on failure. */
export async function exchangeCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<string | null> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  try {
    const res = await request(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      logger.warn('Discord token exchange failed', { status: res.statusCode });
      return null;
    }

    const json = (await res.body.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (error) {
    logger.error('Discord token exchange threw', {
      error: (error as Error).message,
    });
    return null;
  }
}

/** Fetch the authenticated user's profile via their access token. */
export async function fetchUser(accessToken: string): Promise<DiscordUser | null> {
  try {
    const res = await request(`${DISCORD_API}/users/@me`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      logger.warn('Discord /users/@me failed', { status: res.statusCode });
      return null;
    }

    const user = (await res.body.json()) as DiscordUser;
    if (!user || typeof user.id !== 'string') return null;
    return user;
  } catch (error) {
    logger.error('Discord /users/@me threw', {
      error: (error as Error).message,
    });
    return null;
  }
}
