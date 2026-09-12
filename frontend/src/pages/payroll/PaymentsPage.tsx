import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, type Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { payrollApi } from '@/lib/payroll-api';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONE } from '@/lib/org-labels';
import type { Payment } from '@/types/payroll';

const PAGE_SIZE = 20;

function money(v: string) {
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PaymentsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page],
    queryFn: () => payrollApi.listPayments({ page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<Payment>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (row.payroll ? `${row.payroll.employee.firstName} ${row.payroll.employee.lastName}` : '—'),
    },
    { key: 'period', header: 'Period', render: (row) => row.payroll?.payrollPeriod.name ?? '—' },
    { key: 'amount', header: 'Amount', render: (row) => money(row.amount) },
    { key: 'method', header: 'Method', render: (row) => PAYMENT_METHOD_LABELS[row.method] },
    { key: 'reference', header: 'Reference', render: (row) => row.reference ?? '—' },
    { key: 'paidAt', header: 'Date', render: (row) => (row.paidAt ? new Date(row.paidAt).toLocaleDateString() : '—') },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge tone={PAYMENT_STATUS_TONE[row.status]}>{PAYMENT_STATUS_LABELS[row.status]}</StatusBadge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">All salary payments recorded across payroll periods.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table
          columns={columns}
          data={data?.items ?? []}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No payments recorded yet."
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
    </div>
  );
}
