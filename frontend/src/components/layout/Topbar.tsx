import { useState } from 'react';
import { Menu, Search, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/auth-api';
import { ROLE_LABELS } from '@/lib/nav-config';
import { NotificationBell } from './NotificationBell';
import type { RoleCode } from '@/types/auth';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const { user, refreshToken, clearSession } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    clearSession();
    navigate('/login', { replace: true });
  }

  const primaryRole: RoleCode | undefined = user?.roles[0];
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="relative hidden max-w-sm flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Search..."
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {user?.organizationName && (
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 md:inline">
            {user.organizationName}
          </span>
        )}

        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-semibold text-brand-primary">
              {initials}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight text-slate-800">
                {user?.email}
              </span>
              <span className="block text-xs leading-tight text-slate-500">
                {primaryRole ? ROLE_LABELS[primaryRole] : ''}
              </span>
            </span>
            <ChevronDown className="size-4 text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-10 mt-2 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
