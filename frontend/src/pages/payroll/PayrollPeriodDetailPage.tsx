import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PlayCircle, Check, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Table, type Column } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/auth-store';
import { payrollApi } from '@/lib/payroll-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { canApprovePayroll, canProcessPayroll, canReviewPayroll } from '@/lib/ui-permissions';
import { PAYROLL_STATUS_LABELS, PAYROLL_STATUS_TONE } from '@/lib/org-labels';
import type { PayrollListItem } from '@/types/payroll';
import { MarkPaidModal } from './MarkPaidModal';

function money(v: string) {
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PayrollPeriodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canProcess = canProcessPayroll(roles);
  const canReview = canReviewPayroll(roles);
  const canApprove = canApprovePayroll(roles);
  const queryClient = useQueryClient();

  const [markPaidFor, setMarkPaidFor] = useState<string | null>(null);

  const { data: period, isLoading } = useQuery({
    queryKey: ['payroll', 'period', id],
    queryFn: () => payrollApi.getPeriod(id!),
    enabled: !!id,
  });

  const processMutation = useMutation({
    mutationFn: () => payrollApi.processPeriod(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', 'period', id] }),
  });

  const reviewMutation = useMutation({
    mutationFn: (payrollId: string) => payrollApi.review(payrollId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', 'period', id] }),
  });

  const approveMutation = useMutation({
    mutationFn: (payrollId: string) => payrollApi.approve(payrollId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', 'period', id] }),
  });

  const anyMutationError =
    processMutation.error ?? reviewMutation.error ?? approveMutation.error ?? undefined;

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading…</div>;

  if (!period) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-500">Payroll period not found, or you don't have access to view it.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/payroll')}>
          Go back
        </Button>
      </div>
    );
  }

  const columns: Column<PayrollListItem>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => `${row.employee.firstName} ${row.employee.lastName}`,
    },
    { key: 'base', header: 'Base', render: (row) => money(row.baseSalary) },
    { key: 'overtime', header: 'Overtime', render: (row) => money(row.overtimePay) },
    { key: 'allowances', header: 'Allowances', render: (row) => money(row.totalAllowances) },
    { key: 'deductions', header: 'Deductions', render: (row) => money(row.totalDeductions) },
    { key: 'gross', header: 'Gross', render: (row) => money(row.grossPay) },
    { key: 'net', header: 'Net pay', render: (row) => <span className="font-medium text-slate-900">{money(row.netPay)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge tone={PAYROLL_STATUS_TONE[row.status]}>{PAYROLL_STATUS_LABELS[row.status]}</StatusBadge>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-2">
          {canReview && row.status === 'CALCULATED' && (
            <Button
              size="sm"
              variant="secondary"
              isLoading={reviewMutation.isPending && reviewMutation.variables === row.id}
              onClick={() => reviewMutation.mutate(row.id)}
            >
              Move to review
            </Button>
          )}
          {canApprove && row.status === 'UNDER_REVIEW' && (
            <Button
              size="sm"
              isLoading={approveMutation.isPending && approveMutation.variables === row.id}
              onClick={() => approveMutation.mutate(row.id)}
            >
              <Check className="size-4" /> Approve
            </Button>
          )}
          {canApprove && row.status === 'APPROVED' && (
            <Button size="sm" variant="secondary" onClick={() => setMarkPaidFor(row.id)}>
              <Banknote className="size-4" /> Mark paid
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => navigate('/payroll')}
        className="flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" /> Back to payroll
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{period.name}</h1>
            <StatusBadge tone={PAYROLL_STATUS_TONE[period.status]}>{PAYROLL_STATUS_LABELS[period.status]}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(period.periodStart).toLocaleDateString()} – {new Date(period.periodEnd).toLocaleDateString()} ·{' '}
            {period.payrolls.length} employee{period.payrolls.length === 1 ? '' : 's'}
          </p>
        </div>
        {canProcess && period.status === 'DRAFT' && (
          <Button isLoading={processMutation.isPending} onClick={() => processMutation.mutate()}>
            <PlayCircle className="size-4" /> Process payroll
          </Button>
        )}
      </div>

      {anyMutationError && (
        <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">
          {getApiErrorMessage(anyMutationError)}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table
          columns={columns}
          data={period.payrolls}
          rowKey={(row) => row.id}
          emptyMessage="No payroll records yet — process this period to calculate them."
        />
      </div>

      <MarkPaidModal
        open={!!markPaidFor}
        onClose={() => setMarkPaidFor(null)}
        payrollId={markPaidFor}
        periodId={id!}
      />
    </div>
  );
}
