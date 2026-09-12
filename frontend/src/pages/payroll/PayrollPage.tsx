import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Table, type Column } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/auth-store';
import { payrollApi } from '@/lib/payroll-api';
import { canProcessPayroll } from '@/lib/ui-permissions';
import { PAYROLL_STATUS_LABELS, PAYROLL_STATUS_TONE } from '@/lib/org-labels';
import type { PayrollPeriod } from '@/types/payroll';
import { CreatePeriodModal } from './CreatePeriodModal';

export function PayrollPage() {
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canCreate = canProcessPayroll(roles);
  const [showCreate, setShowCreate] = useState(false);

  const { data: periods, isLoading } = useQuery({
    queryKey: ['payroll', 'periods'],
    queryFn: payrollApi.listPeriods,
  });

  const columns: Column<PayrollPeriod>[] = [
    { key: 'name', header: 'Period', render: (row) => row.name },
    {
      key: 'dates',
      header: 'Dates',
      render: (row) => `${new Date(row.periodStart).toLocaleDateString()} – ${new Date(row.periodEnd).toLocaleDateString()}`,
    },
    { key: 'count', header: 'Employees', render: (row) => row._count.payrolls },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge tone={PAYROLL_STATUS_TONE[row.status]}>{PAYROLL_STATUS_LABELS[row.status]}</StatusBadge>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payroll</h1>
          <p className="mt-1 text-sm text-slate-500">Manage payroll periods, calculations and approvals.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> New period
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table
          columns={columns}
          data={periods ?? []}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No payroll periods yet."
          onRowClick={(row) => navigate(`/payroll/${row.id}`)}
        />
      </div>

      <CreatePeriodModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
