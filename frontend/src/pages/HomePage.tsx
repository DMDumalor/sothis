import type { ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ShieldCheck, Building2, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/auth-api';
import { ROLE_LABELS } from '@/lib/nav-config';

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const { data: me } = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = me?.employee?.firstName ?? user?.email.split('@')[0] ?? '';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
        <p className="text-sm font-medium text-blue-900">
          Foundation milestone (M1) is live: authentication, RBAC, tenant isolation and audit
          logging are wired end-to-end against a real database.
        </p>
        <p className="mt-1 text-sm text-blue-800">
          Role-specific dashboards, KPI cards and charts for {user ? ROLE_LABELS[user.roles[0]] : 'your role'} land in the
          next milestones (People, Time, Money, Insight) — this page intentionally shows only
          what is real right now rather than placeholder numbers.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoCard
          icon={Building2}
          label="Organization"
          value={me?.tenant?.name ?? user?.organizationName ?? '—'}
          sub={`Code: ${me?.tenant?.code ?? user?.organizationCode ?? '—'}`}
        />
        <InfoCard
          icon={ShieldCheck}
          label="Roles"
          value={(me?.roles ?? user?.roles ?? []).map((r) => ROLE_LABELS[r]).join(', ') || '—'}
          sub="Enforced server-side via role → permission → scope"
        />
        <InfoCard icon={KeyRound} label="Signed in as" value={me?.email ?? user?.email ?? '—'} sub="Session via rotating refresh tokens" />
        <InfoCard
          icon={CheckCircle2}
          label="Session status"
          value="Active"
          sub="Access token auto-refreshes in the background"
        />
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-base font-semibold text-slate-900">{value}</p>
        <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  );
}
