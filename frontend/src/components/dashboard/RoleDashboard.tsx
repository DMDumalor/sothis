import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Wallet, ShieldAlert, Sparkles, CalendarDays, Clock, ArrowRight } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { reportsApi } from '@/lib/reports-api';
import { intelligenceApi } from '@/lib/intelligence-api';
import { securityApi } from '@/lib/security-api';
import { RISK_LEVEL_TONE } from '@/lib/org-labels';
import type { RoleCode } from '@/types/auth';

/**
 * Role-specific dashboard widgets (spec section 32's "role-specific
 * dashboards"). Every query here hits a real M5 endpoint — the backend's
 * own permission grants (not this component) decide what data comes
 * back, so a role missing a given permission simply never issues that
 * query rather than the UI trying to hide something the API would refuse
 * anyway.
 */
export function RoleDashboard({ primaryRole }: { primaryRole: RoleCode }) {
  const navigate = useNavigate();
  const hasReports = ['ADMIN', 'HR', 'DEPARTMENT_HEAD', 'FINANCE', 'DG'].includes(primaryRole);
  const hasPayroll = primaryRole === 'FINANCE' || primaryRole === 'DG';
  const hasInsights = primaryRole !== 'EMPLOYEE';
  const hasSecurity = primaryRole === 'ADMIN' || primaryRole === 'DG';

  const { data: workforce } = useQuery({
    queryKey: ['reports', 'workforce'],
    queryFn: reportsApi.workforce,
    enabled: hasReports,
  });
  const { data: leave } = useQuery({
    queryKey: ['reports', 'leave'],
    queryFn: () => reportsApi.leave(),
    enabled: hasReports,
  });
  const { data: attendance } = useQuery({
    queryKey: ['reports', 'attendance'],
    queryFn: () => reportsApi.attendance(),
    enabled: hasReports,
  });
  const { data: payroll } = useQuery({
    queryKey: ['reports', 'payroll'],
    queryFn: () => reportsApi.payroll(),
    enabled: hasPayroll,
  });
  const { data: insightsSummary } = useQuery({
    queryKey: ['intelligence', 'summary'],
    queryFn: intelligenceApi.summary,
    enabled: hasInsights,
  });
  const { data: topInsights } = useQuery({
    queryKey: ['intelligence', 'insights', 'dashboard-preview'],
    queryFn: () => intelligenceApi.list({ status: 'OPEN', pageSize: 3 }),
    enabled: hasInsights,
  });
  const { data: securitySummary } = useQuery({
    queryKey: ['security', 'summary'],
    queryFn: securityApi.summary,
    enabled: hasSecurity,
  });

  if (!hasReports && !hasInsights) return null;

  const latestPeriod = payroll?.trend[payroll.trend.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {hasReports && (
          <KpiCard icon={Users} label="Total headcount" value={workforce?.totalHeadcount ?? '—'} tone="info" />
        )}
        {hasReports && (
          <KpiCard
            icon={CalendarDays}
            label="Pending leave requests"
            value={leave?.byStatus.PENDING ?? 0}
            tone="warning"
            sub="Awaiting approval"
          />
        )}
        {hasReports && (
          <KpiCard
            icon={Clock}
            label="Punctuality rate"
            value={attendance?.punctualityRate !== null && attendance?.punctualityRate !== undefined ? `${Math.round(attendance.punctualityRate * 100)}%` : '—'}
            tone="success"
          />
        )}
        {hasPayroll && latestPeriod && (
          <KpiCard
            icon={Wallet}
            label={`Net payroll — ${latestPeriod.periodName}`}
            value={latestPeriod.totalNet.toLocaleString()}
            tone="info"
          />
        )}
        {hasInsights && (
          <KpiCard
            icon={Sparkles}
            label="Open smart insights"
            value={insightsSummary?.openCount ?? 0}
            tone={(insightsSummary?.openCount ?? 0) > 0 ? 'warning' : 'success'}
          />
        )}
        {hasSecurity && (
          <KpiCard
            icon={ShieldAlert}
            label="Unresolved security events"
            value={securitySummary?.unresolvedCount ?? 0}
            tone={(securitySummary?.criticalUnresolvedCount ?? 0) > 0 ? 'error' : 'neutral'}
          />
        )}
      </div>

      {hasInsights && (topInsights?.items.length ?? 0) > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Insights needing attention</h2>
            <button
              onClick={() => navigate('/intelligence')}
              className="flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
            >
              View all <ArrowRight className="size-3.5" />
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {topInsights?.items.map((insight) => (
              <li
                key={insight.id}
                onClick={() => navigate('/intelligence')}
                className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{insight.title}</p>
                  <p className="truncate text-xs text-slate-500">{insight.affectedArea}</p>
                </div>
                <StatusBadge tone={RISK_LEVEL_TONE[insight.riskLevel]}>{insight.riskScore}</StatusBadge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
