import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, X as XIcon, Ban } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Table, type Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/auth-api';
import { leaveApi } from '@/lib/leave-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { canApproveLeave } from '@/lib/ui-permissions';
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_TONE } from '@/lib/org-labels';
import type { LeaveRequest, LeaveRequestStatus } from '@/types/time';
import { LeaveRequestFormModal } from './LeaveRequestFormModal';

const PAGE_SIZE = 10;

function formatDateRange(start: string, end: string) {
  const s = new Date(start).toLocaleDateString();
  const e = new Date(end).toLocaleDateString();
  return s === e ? s : `${s} – ${e}`;
}

export function LeavePage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const isEmployee = roles.includes('EMPLOYEE');
  const canApprove = canApproveLeave(roles);
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me });

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [myPage, setMyPage] = useState(1);
  const [approvalsPage, setApprovalsPage] = useState(1);
  const [approvalsStatus, setApprovalsStatus] = useState<LeaveRequestStatus | ''>('PENDING');
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);

  const { data: balances } = useQuery({
    queryKey: ['leave', 'balances'],
    queryFn: () => leaveApi.listBalances(),
    enabled: !!me?.employee,
  });

  const { data: myRequests, isLoading: myLoading } = useQuery({
    queryKey: ['leave', 'requests', 'mine', myPage],
    queryFn: () => leaveApi.list({ page: myPage, pageSize: PAGE_SIZE }),
    enabled: !!me?.employee && isEmployee,
    placeholderData: (prev) => prev,
  });

  const { data: approvalRequests, isLoading: approvalsLoading } = useQuery({
    queryKey: ['leave', 'requests', 'approvals', approvalsPage, approvalsStatus],
    queryFn: () =>
      leaveApi.list({
        page: approvalsPage,
        pageSize: PAGE_SIZE,
        status: approvalsStatus || undefined,
      }),
    enabled: canApprove,
    placeholderData: (prev) => prev,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => leaveApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) => leaveApi.reject(id, comment || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      setRejecting(null);
      setRejectComment('');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => leaveApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      setCancelling(null);
    },
  });

  const myColumns: Column<LeaveRequest>[] = [
    { key: 'type', header: 'Leave type', render: (row) => row.leaveType.name },
    { key: 'dates', header: 'Dates', render: (row) => formatDateRange(row.startDate, row.endDate) },
    { key: 'days', header: 'Days', render: (row) => Number(row.days) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge tone={LEAVE_STATUS_TONE[row.status]}>{LEAVE_STATUS_LABELS[row.status]}</StatusBadge>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'PENDING' && (
          <Button variant="ghost" size="sm" onClick={() => setCancelling(row)}>
            <Ban className="size-4" /> Cancel
          </Button>
        ),
    },
  ];

  const approvalColumns: Column<LeaveRequest>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => `${row.employee.firstName} ${row.employee.lastName}`,
    },
    { key: 'type', header: 'Leave type', render: (row) => row.leaveType.name },
    { key: 'dates', header: 'Dates', render: (row) => formatDateRange(row.startDate, row.endDate) },
    { key: 'days', header: 'Days', render: (row) => Number(row.days) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge tone={LEAVE_STATUS_TONE[row.status]}>{LEAVE_STATUS_LABELS[row.status]}</StatusBadge>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
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
            <Button variant="ghost" size="sm" onClick={() => setRejecting(row)}>
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
          <h1 className="text-2xl font-semibold text-slate-900">Leave</h1>
          <p className="mt-1 text-sm text-slate-500">Manage leave requests and approvals.</p>
        </div>
        {isEmployee && me?.employee && (
          <Button onClick={() => setShowRequestModal(true)}>
            <Plus className="size-4" /> Request leave
          </Button>
        )}
      </div>

      {me?.employee && balances && balances.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {balances.map((b) => {
            const available =
              Number(b.allocatedDays) + Number(b.carriedOverDays) - Number(b.usedDays) - Number(b.pendingDays);
            return (
              <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">{b.leaveType.name}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{available}</p>
                <p className="text-xs text-slate-400">days available</p>
                <div className="mt-3 flex justify-between text-xs text-slate-500">
                  <span>Used: {Number(b.usedDays)}</span>
                  <span>Pending: {Number(b.pendingDays)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isEmployee && me?.employee && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-900">My requests</h2>
          </div>
          <Table
            columns={myColumns}
            data={myRequests?.items ?? []}
            rowKey={(row) => row.id}
            isLoading={myLoading}
            emptyMessage="You haven't requested any leave yet."
          />
          {myRequests && (
            <Pagination
              page={myRequests.pagination.page}
              pageSize={myRequests.pagination.pageSize}
              total={myRequests.pagination.total}
              totalPages={myRequests.pagination.totalPages}
              onPageChange={setMyPage}
            />
          )}
        </div>
      )}

      {canApprove && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-900">Leave requests</h2>
            <div className="w-48">
              <Select
                value={approvalsStatus}
                onChange={(e) => {
                  setApprovalsStatus(e.target.value as LeaveRequestStatus | '');
                  setApprovalsPage(1);
                }}
              >
                <option value="">All statuses</option>
                {Object.entries(LEAVE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Table
            columns={approvalColumns}
            data={approvalRequests?.items ?? []}
            rowKey={(row) => row.id}
            isLoading={approvalsLoading}
            emptyMessage="No leave requests found."
          />
          {approvalRequests && (
            <Pagination
              page={approvalRequests.pagination.page}
              pageSize={approvalRequests.pagination.pageSize}
              total={approvalRequests.pagination.total}
              totalPages={approvalRequests.pagination.totalPages}
              onPageChange={setApprovalsPage}
            />
          )}
        </div>
      )}

      <LeaveRequestFormModal open={showRequestModal} onClose={() => setShowRequestModal(false)} />

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject leave request"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)} disabled={rejectMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={rejectMutation.isPending}
              onClick={() => rejecting && rejectMutation.mutate({ id: rejecting.id, comment: rejectComment })}
            >
              Reject request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {rejectMutation.isError && (
            <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">
              {getApiErrorMessage(rejectMutation.error)}
            </div>
          )}
          <p className="text-sm text-slate-600">
            Rejecting {rejecting?.employee.firstName} {rejecting?.employee.lastName}'s {rejecting?.leaveType.name}{' '}
            request.
          </p>
          <textarea
            className="min-h-24 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            placeholder="Reason for rejection (optional)"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel leave request?"
        description="This will withdraw your pending leave request and release the reserved balance."
        confirmLabel="Cancel request"
        danger
        isLoading={cancelMutation.isPending}
        onConfirm={() => cancelling && cancelMutation.mutate(cancelling.id)}
        onCancel={() => setCancelling(null)}
      />
    </div>
  );
}
