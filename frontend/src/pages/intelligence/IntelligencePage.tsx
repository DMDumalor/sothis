import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, AlertTriangle, ShieldAlert, Wallet, CalendarDays, Clock, RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { KpiCard } from '@/components/ui/KpiCard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useAuthStore } from '@/stores/auth-store';
import { intelligenceApi } from '@/lib/intelligence-api';
import { INSIGHT_STATUS_LABELS, INSIGHT_STATUS_TONE, RISK_LEVEL_LABELS, RISK_LEVEL_TONE } from '@/lib/org-labels';
import type { InsightCategory, SmartInsight } from '@/types/intelligence';

const CATEGORY_ICON: Record<InsightCategory, typeof Wallet> = {
  PAYROLL: Wallet,
  ATTENDANCE: Clock,
  LEAVE: CalendarDays,
  SECURITY: ShieldAlert,
  WORKFORCE: Sparkles,
};

function InsightCard({ insight, onReview, canReview }: { insight: SmartInsight; onReview: (i: SmartInsight) => void; canReview: boolean }) {
  const Icon = CATEGORY_ICON[insight.category];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Icon className="size-4.5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{insight.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {insight.affectedArea} · {new Date(insight.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge tone={RISK_LEVEL_TONE[insight.riskLevel]}>
            {RISK_LEVEL_LABELS[insight.riskLevel]} · {insight.riskScore}
          </StatusBadge>
          <StatusBadge tone={INSIGHT_STATUS_TONE[insight.status]}>{INSIGHT_STATUS_LABELS[insight.status]}</StatusBadge>
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 p-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Why this was flagged</p>
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
          {insight.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-900">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>{insight.recommendedAction}</span>
      </div>

      {insight.reviewNote && (
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-700">Review note:</span> {insight.reviewNote}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Rule: {insight.ruleCode}</span>
        {canReview && (insight.status === 'OPEN' || insight.status === 'UNDER_REVIEW') && (
          <Button size="sm" variant="secondary" onClick={() => onReview(insight)}>
            Review
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewModal({ insight, onClose }: { insight: SmartInsight | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'UNDER_REVIEW' | 'REVIEWED' | 'DISMISSED'>('REVIEWED');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () => intelligenceApi.review(insight!.id, status, note || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence'] });
      onClose();
      setNote('');
    },
  });

  if (!insight) return null;

  return (
    <Modal
      open={!!insight}
      onClose={onClose}
      title="Review smart insight"
      description={insight.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending}>
            Save decision
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="Decision"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'UNDER_REVIEW' | 'REVIEWED' | 'DISMISSED')}
        >
          <option value="UNDER_REVIEW">Keep under review</option>
          <option value="REVIEWED">Mark reviewed (action taken)</option>
          <option value="DISMISSED">Dismiss (false positive / no action needed)</option>
        </Select>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            placeholder="Explain what was reviewed or why this was dismissed…"
          />
        </div>
      </div>
    </Modal>
  );
}

export function IntelligencePage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canReview = roles.some((r) => r === 'ADMIN' || r === 'HR' || r === 'FINANCE');
  const [statusFilter, setStatusFilter] = useState('OPEN_OR_REVIEW');
  const [reviewing, setReviewing] = useState<SmartInsight | null>(null);
  const queryClient = useQueryClient();

  const { data: summary } = useQuery({ queryKey: ['intelligence', 'summary'], queryFn: intelligenceApi.summary });
  const { data, isLoading } = useQuery({
    queryKey: ['intelligence', 'insights', statusFilter],
    queryFn: () =>
      intelligenceApi.list(statusFilter === 'OPEN_OR_REVIEW' ? { pageSize: 50 } : { status: statusFilter, pageSize: 50 }),
  });

  const runMutation = useMutation({
    mutationFn: intelligenceApi.runDetectors,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['intelligence'] }),
  });

  const items = (data?.items ?? []).filter(
    (i) => statusFilter !== 'OPEN_OR_REVIEW' || i.status === 'OPEN' || i.status === 'UNDER_REVIEW',
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Smart Insights</h1>
          <p className="mt-1 text-sm text-slate-500">
            Explainable, rule-based risk detection — every insight shows the exact rule, the data behind it, and a
            recommended next step. Nothing here acts automatically; a human always reviews before action is taken.
          </p>
        </div>
        {canReview && (
          <Button variant="secondary" onClick={() => runMutation.mutate()} isLoading={runMutation.isPending}>
            <RefreshCw className="size-4" /> Run detection now
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard icon={Sparkles} label="Open" value={summary?.openCount ?? '—'} tone="warning" />
        <KpiCard icon={Sparkles} label="Under review" value={summary?.underReviewCount ?? '—'} tone="info" />
        <KpiCard icon={ShieldAlert} label="High risk" value={summary?.byRiskLevel?.HIGH ?? 0} tone="error" />
        <KpiCard icon={ShieldAlert} label="Critical risk" value={summary?.byRiskLevel?.CRITICAL ?? 0} tone="error" />
      </div>

      <div className="max-w-xs">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="OPEN_OR_REVIEW">Open & under review</option>
          <option value="OPEN">Open only</option>
          <option value="UNDER_REVIEW">Under review only</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="DISMISSED">Dismissed</option>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No insights match this filter.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((insight) => (
          <InsightCard key={insight.id} insight={insight} onReview={setReviewing} canReview={canReview} />
        ))}
      </div>

      <ReviewModal insight={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
}
