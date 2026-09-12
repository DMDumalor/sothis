import { useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/auth-api';

/**
 * Module-level (not per-render) in-flight guard. React 19's StrictMode
 * intentionally double-invokes effects in development (mount → cleanup →
 * mount), and this hook's effect used to rely only on a per-invocation
 * `cancelled` flag to ignore the "duplicate" run's result. That guarded
 * against a stale *result* being applied, but did nothing to stop the
 * *network call* itself from firing twice — both invocations captured the
 * same refresh token from the same render and both issued
 * POST /auth/refresh with it. The first call rotates the token normally;
 * the second, now using an already-rotated token, trips the backend's
 * refresh-token REUSE DETECTION (spec section 9) and revokes the entire
 * token family — including the brand new token the first call just
 * received. The net effect was a fully valid session getting silently
 * logged out (and a false-positive HIGH-severity security event logged)
 * on every hard navigation/full page reload, not just under StrictMode —
 * the same race is possible in production with two tabs or a retried
 * request. A shared promise, keyed at module scope, ensures only one
 * refresh is ever actually sent no matter how many times the effect body
 * runs for the same bootstrap attempt.
 */
let bootstrapPromise: Promise<void> | null = null;

async function runBootstrap(refreshToken: string) {
  try {
    const { data } = await axios.post('/api/auth/refresh', { refreshToken });
    useAuthStore.getState().setAccessToken(data.accessToken);
    const me = await authApi.me();
    useAuthStore.getState().setSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: {
        id: me.id,
        email: me.email,
        roles: me.roles,
        organizationCode: me.tenant?.code ?? '',
        organizationName: me.tenant?.name ?? '',
      },
    });
  } catch {
    useAuthStore.getState().clearSession();
  }
}

/**
 * Runs once on app load. If a refresh token survived from a previous
 * session (localStorage) but there is no in-memory access token/user (a
 * fresh page load), silently re-authenticates: rotate the refresh token,
 * then fetch /auth/me to repopulate the user object. Failure just drops
 * back to the login page — it never fabricates a session.
 */
export function useBootstrapAuth() {
  const { refreshToken, user, setInitializing } = useAuthStore();

  useEffect(() => {
    if (!refreshToken || user) {
      setInitializing(false);
      return;
    }

    if (!bootstrapPromise) {
      bootstrapPromise = runBootstrap(refreshToken).finally(() => {
        bootstrapPromise = null;
      });
    }

    let cancelled = false;
    bootstrapPromise.finally(() => {
      if (!cancelled) setInitializing(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
