import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Table, type Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/auth-api';
import { overtimeApi } from '@/lib/overtime-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { canApproveOvertime, canSubmitOvertime } from '@/lib/ui-permissions';
import { OVERTIME_STATUS_LABELS, OVERTIME_STATUS_TONE } from '@/lib/org-labels';
import type { OvertimeRecord, OvertimeStatus } from '@/types/time';
import { OvertimeFormModal } from './OvertimeFormModal';

const PAGE_SIZE = 15;

export function OvertimePage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canApprove = canApproveOvertime(roles);
  const canSubmit = canSubmitOvertime(roles);
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me });

  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OvertimeStatus | ''>('');

  const { data, isLoading } = useQuery({
    queryKey: ['overtime', 'records', { page, status }],
    queryFn: () => overtimeApi.list({ page, pageSize: PAGE_SIZE, status: status || undefined }),
    placeholderData: (prev) => prev,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => overtimeApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['overtime'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => overtimeApi.reject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['overtime'] }),
  });

  const columns: Column<OvertimeRecord>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => `${row.employee.firstName} ${row.employee.lastName}`,
    },
    { key: 'date', header: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { key: 'hours', header: 'Hours', render: (row) => Number(row.hours) },
    { key: 'reason', header: 'Reason', render: (row) => row.reason ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge tone={OVERTIME_STATUS_TONE[row.status]}>{OVERTIME_STATUS_LABELS[row.status]}</StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canApprove &&
        row.status === 'PENDING' && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              isLoading={approveMutation.isPending && approveMutation.variables === row.id}
              onClick={() => approveMutation.mutate(row.id)}
            >
              <Check className="size-4" /> Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              isLoading={rejectMutation.isPending && rejectMutation.variables === row.id}
              onClick={() => rejectMutation.mutate(row.id)}
            >
              <XIcon className="size-4" /> Reject
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Overtime</h1>
          <p className="mt-1 text-sm text-slate-500">Submit and review overtime records.</p>
        </div>
        {me?.employee && canSubmit && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="size-4" /> Submit overtime
          </Button>
        )}
      </div>

      {(approveMutation.isError || rejectMutation.isError) && (
        <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">
          {getApiErrorMessage(approveMutation.error ?? rejectMutation.error)}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <div className="w-44">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as OvertimeStatus | '');
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {Object.entries(OVERTIME_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Table
          columns={columns}
          data={data?.items ?? []}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No overtime records found."
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

      <OvertimeFormModal open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}
