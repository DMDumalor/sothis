import type { ComponentType } from 'react';
import clsx from 'clsx';

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  error: 'bg-red-50 text-red-600',
  info: 'bg-blue-50 text-blue-600',
};

interface KpiCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone?: Tone;
}

/** Compact KPI stat card used across dashboards and analytics pages (spec section 32). */
export function KpiCard({ icon: Icon, label, value, sub, tone = 'neutral' }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={clsx('flex size-9 shrink-0 items-center justify-center rounded-lg', toneClasses[tone])}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
