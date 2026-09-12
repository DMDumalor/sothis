import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, type Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/auth-store';
import { payrollApi } from '@/lib/payroll-api';
import { PAYROLL_STATUS_LABELS, PAYROLL_STATUS_TONE } from '@/lib/org-labels';
import type { Payslip } from '@/types/payroll';
import { PayslipDetailModal } from './PayslipDetailModal';

const PAGE_SIZE = 20;

function money(v: string) {
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PayslipsPage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const isEmployee = roles.includes('EMPLOYEE');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payslips', page],
    queryFn: () => payrollApi.listPayslips({ page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<Payslip>[] = [
    ...(isEmployee
      ? []
      : [
          {
            key: 'employee',
            header: 'Employee',
            render: (row: Payslip) => `${row.payroll.employee.firstName} ${row.payroll.employee.lastName}`,
          } as Column<Payslip>,
        ]),
    { key: 'period', header: 'Period', render: (row) => row.payroll.payrollPeriod.name },
    { key: 'net', header: 'Net pay', render: (row) => money(row.payroll.netPay) },
    { key: 'issued', header: 'Issued', render: (row) => new Date(row.issuedAt).toLocaleDateString() },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge tone={PAYROLL_STATUS_TONE[row.payroll.status]}>
          {PAYROLL_STATUS_LABELS[row.payroll.status]}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Payslips</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isEmployee ? 'Your issued payslips.' : 'All issued payslips.'}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table
          columns={columns}
          data={data?.items ?? []}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No payslips issued yet."
          onRowClick={(row) => setViewing(row.id)}
        />
        {data && (
          <Pagination
            page={data.pagination.page}
            pageSize={data.pagination.pageSize}
            total={data.pagination.total}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      <PayslipDetailModal id={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
