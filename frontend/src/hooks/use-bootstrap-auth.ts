import { useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/auth-api';

/**
 * Runs once on app load. If a refresh token survived from a previous
 * session (localStorage) but there is no in-memory access token/user (a
 * fresh page load), silently re-authenticates: rotate the refresh token,
 * then fetch /auth/me to repopulate the user object. Failure just drops
 * back to the login page — it never fabricates a session.
 */
export function useBootstrapAuth() {
  const { refreshToken, user, setSession, clearSession, setInitializing } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!refreshToken || user) {
        setInitializing(false);
        return;
      }

      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        useAuthStore.getState().setAccessToken(data.accessToken);
        const me = await authApi.me();
        if (cancelled) return;
        setSession({
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
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
