import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, KeyRound, UserX, UserCheck, RotateCcw, Ban, Eye, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, type Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/stores/auth-store';
import { usersApi } from '@/lib/users-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/nav-config';
import { USER_STATUS_LABELS, USER_STATUS_TONE, INVITATION_STATUS_LABELS, INVITATION_STATUS_TONE } from '@/lib/org-labels';
import type { RoleCode } from '@/types/auth';
import type { AccountInvitation, UserListItem, UserStatus } from '@/types/users';
import { InviteUserModal } from './InviteUserModal';
import { UserRolesModal } from './UserRolesModal';
import { BulkInviteModal } from './BulkInviteModal';
import { UserDetailModal } from './UserDetailModal';

const PAGE_SIZE = 20;
const ROLE_OPTIONS: RoleCode[] = ['ADMIN', 'HR', 'DEPARTMENT_HEAD', 'FINANCE', 'DG', 'EMPLOYEE'];

function UsersTab() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [editingRoles, setEditingRoles] = useState<UserListItem | null>(null);
  const [viewingUser, setViewingUser] = useState<UserListItem | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<UserListItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'list', { search, status, role, page }],
    queryFn: () =>
      usersApi.list({
        search: search || undefined,
        status: (status || undefined) as UserStatus | undefined,
        role: (role || undefined) as RoleCode | undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'ACTIVE' | 'DISABLED' }) => usersApi.updateStatus(id, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setConfirmDisable(null);
    },
    onError: (error) => setErrorMessage(getApiErrorMessage(error)),
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) => usersApi.unlock(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (error) => setErrorMessage(getApiErrorMessage(error)),
  });

  const columns: Column<UserListItem>[] = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : row.email}
          </p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department / Position',
      render: (row) =>
        row.employee ? (
          <div className="text-sm">
            <p className="text-slate-700">{row.employee.department?.name ?? '—'}</p>
            <p className="text-xs text-slate-500">{row.employee.position?.title ?? '—'}</p>
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.userRoles.map((ur) => (
            <StatusBadge key={ur.role.id} tone="info">
              {ROLE_LABELS[ur.role.code]}
            </StatusBadge>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge tone={USER_STATUS_TONE[row.status]}>{USER_STATUS_LABELS[row.status]}</StatusBadge>,
    },
    {
      key: 'lastLogin',
      header: 'Last login',
      render: (row) => (row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : 'Never'),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => {
        const isSelf = row.id === currentUserId;
        return (
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => setViewingUser(row)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={`View details for ${row.email}`}
              title="View details"
            >
              <Eye className="size-4" />
            </button>
            <button
              onClick={() => setEditingRoles(row)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={`Edit roles for ${row.email}`}
              title="Edit roles"
            >
              <ShieldCheck className="size-4" />
            </button>
            {row.status === 'LOCKED' && (
              <button
                onClick={() => unlockMutation.mutate(row.id)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600"
                aria-label={`Unlock ${row.email}`}
                title="Unlock account"
              >
                <KeyRound className="size-4" />
              </button>
            )}
            {row.status === 'DISABLED' ? (
              <button
                onClick={() => statusMutation.mutate({ id: row.id, next: 'ACTIVE' })}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600"
                aria-label={`Enable ${row.email}`}
                title="Enable account"
              >
                <UserCheck className="size-4" />
              </button>
            ) : (
              !isSelf && (
                <button
                  onClick={() => setConfirmDisable(row)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-error"
                  aria-label={`Disable ${row.email}`}
                  title="Disable account"
                >
                  <UserX className="size-4" />
                </button>
              )
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-2.5 text-sm text-brand-error">
          {errorMessage}
          <button onClick={() => setErrorMessage(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <div className="min-w-[220px] flex-1">
            <Input
              placeholder="Search name, email, or employee code…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-48">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {Object.entries(USER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <Select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {ROLE_LABELS[code]}
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
          emptyMessage="No users match your filters."
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

      <UserRolesModal open={!!editingRoles} onClose={() => setEditingRoles(null)} user={editingRoles} />
      <UserDetailModal open={!!viewingUser} onClose={() => setViewingUser(null)} user={viewingUser} />

      <ConfirmDialog
        open={!!confirmDisable}
        title="Disable account?"
        description={`${confirmDisable?.email} will immediately lose access until re-enabled.`}
        confirmLabel="Disable"
        danger
        isLoading={statusMutation.isPending}
        onConfirm={() => confirmDisable && statusMutation.mutate({ id: confirmDisable.id, next: 'DISABLED' })}
        onCancel={() => setConfirmDisable(null)}
      />
    </div>
  );
}

function InvitationsTab() {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'invitations'],
    queryFn: usersApi.listInvitations,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => usersApi.revokeInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', 'invitations'] }),
    onError: (error) => setErrorMessage(getApiErrorMessage(error)),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => usersApi.resendInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', 'invitations'] }),
    onError: (error) => setErrorMessage(getApiErrorMessage(error)),
  });

  const columns: Column<AccountInvitation>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.employee.firstName} {row.employee.lastName}
          </p>
          <p className="text-xs text-slate-500">{row.employee.employeeCode}</p>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (row) => row.email },
    {
      key: 'role',
      header: 'Intended role',
      render: (row) => (row.intendedRoleCode ? ROLE_LABELS[row.intendedRoleCode] : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge tone={INVITATION_STATUS_TONE[row.status]}>{INVITATION_STATUS_LABELS[row.status]}</StatusBadge>
      ),
    },
    { key: 'invitedBy', header: 'Invited by', render: (row) => row.invitedBy.email },
    {
      key: 'expires',
      header: 'Expires',
      render: (row) => new Date(row.expiresAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) =>
        row.status === 'PENDING' ? (
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => resendMutation.mutate(row.id)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-primary"
              aria-label={`Resend invitation to ${row.email}`}
              title="Resend"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              onClick={() => revokeMutation.mutate(row.id)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-error"
              aria-label={`Revoke invitation to ${row.email}`}
              title="Revoke"
            >
              <Ban className="size-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-2.5 text-sm text-brand-error">
          {errorMessage}
          <button onClick={() => setErrorMessage(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table
          columns={columns}
          data={data ?? []}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No invitations have been sent yet."
        />
      </div>
    </div>
  );
}

export function UsersPage() {
  const [tab, setTab] = useState<'users' | 'invitations'>('users');
  const [showInvite, setShowInvite] = useState(false);
  const [showBulkInvite, setShowBulkInvite] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage platform accounts, roles, and account invitations for this organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowBulkInvite(true)}>
            <Upload className="size-4" />
            Bulk invite
          </Button>
          <Button onClick={() => setShowInvite(true)}>
            <Plus className="size-4" />
            Invite user
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'users', label: 'Users' },
          { key: 'invitations', label: 'Invitations' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {tab === 'users' ? <UsersTab /> : <InvitationsTab />}

      <InviteUserModal open={showInvite} onClose={() => setShowInvite(false)} />
      <BulkInviteModal open={showBulkInvite} onClose={() => setShowBulkInvite(false)} />
    </div>
  );
}
