import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, LogOut, ShieldCheck, KeyRound } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usersApi } from '@/lib/users-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { LOGIN_AUDIT_RESULT_LABELS, LOGIN_AUDIT_RESULT_TONE } from '@/lib/org-labels';
import type { UserListItem } from '@/types/users';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function humanizeAction(action: string): string {
  return action.replaceAll('_', ' ').replaceAll('.', ' — ');
}

function SessionsTab({ user }: { user: UserListItem }) {
  const queryClient = useQueryClient();
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['users', user.id, 'sessions'],
    queryFn: () => usersApi.listSessions(user.id),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => usersApi.revokeSession(user.id, sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', user.id, 'sessions'] }),
    onError: (error) => setErrorMessage(getApiErrorMessage(error)),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => usersApi.revokeAllSessions(user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', user.id, 'sessions'] });
      setConfirmRevokeAll(false);
    },
    onError: (error) => setErrorMessage(getApiErrorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        Revoking a session stops it from renewing — an already-issued access token can stay valid for up to 15
        minutes after that.
      </p>

      {errorMessage && (
        <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errorMessage}</div>
      )}

      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setConfirmRevokeAll(true)}
          disabled={!sessions || sessions.length === 0}
        >
          <LogOut className="size-4" />
          Sign out everywhere
        </Button>
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {!isLoading && sessions?.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">No active sessions.</p>
      )}

      <div className="flex flex-col gap-2">
        {sessions?.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Laptop className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {session.userAgent ?? 'Unknown device'}
                </p>
                <p className="text-xs text-slate-500">
                  {session.createdByIp ?? 'Unknown IP'} · signed in {timeAgo(session.createdAt)} · expires{' '}
                  {new Date(session.expiresAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              isLoading={revokeMutation.isPending && revokeMutation.variables === session.id}
              onClick={() => revokeMutation.mutate(session.id)}
            >
              Revoke
            </Button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmRevokeAll}
        title="Sign out everywhere?"
        description={`Every active session for ${user.email} will stop renewing. They'll need to log in again on every device.`}
        confirmLabel="Sign out everywhere"
        danger
        isLoading={revokeAllMutation.isPending}
        onConfirm={() => revokeAllMutation.mutate()}
        onCancel={() => setConfirmRevokeAll(false)}
      />
    </div>
  );
}

function ActivityTab({ user }: { user: UserListItem }) {
  const { data: activity, isLoading } = useQuery({
    queryKey: ['users', user.id, 'activity'],
    queryFn: () => usersApi.getActivity(user.id),
  });

  return (
    <div className="flex flex-col gap-3">
      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {!isLoading && activity?.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">No recorded activity yet.</p>
      )}

      <div className="flex flex-col divide-y divide-slate-100">
        {activity?.map((entry) => (
          <div key={`${entry.kind}-${entry.id}`} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              {entry.kind === 'login' ? <KeyRound className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              {entry.kind === 'login' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={LOGIN_AUDIT_RESULT_TONE[entry.result]}>
                    {LOGIN_AUDIT_RESULT_LABELS[entry.result]}
                  </StatusBadge>
                  {entry.ipAddress && <span className="text-xs text-slate-500">from {entry.ipAddress}</span>}
                </div>
              ) : (
                <p className="text-sm text-slate-800">{humanizeAction(entry.action)}</p>
              )}
              <p className="mt-0.5 text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserDetailContent({ user, onClose }: { user: UserListItem; onClose: () => void }) {
  const [tab, setTab] = useState<'sessions' | 'activity'>('sessions');

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user.email}
      description={user.email}
    >
      <div className="flex flex-col gap-4">
        <Tabs
          tabs={[
            { key: 'sessions', label: 'Sessions' },
            { key: 'activity', label: 'Activity' },
          ]}
          active={tab}
          onChange={(k) => setTab(k as typeof tab)}
        />
        {tab === 'sessions' ? <SessionsTab user={user} /> : <ActivityTab user={user} />}
      </div>
    </Modal>
  );
}

export function UserDetailModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: UserListItem | null;
}) {
  if (!open || !user) return null;
  return <UserDetailContent key={user.id} user={user} onClose={onClose} />;
}
