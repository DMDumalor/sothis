import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  KeyRound,
  Laptop,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toggle } from '@/components/ui/Toggle';
import { settingsApi } from '@/lib/settings-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { NOTIFICATION_CATEGORY_LABELS } from '@/lib/org-labels';
import { ROLE_LABELS } from '@/lib/nav-config';
import { useAuthStore } from '@/stores/auth-store';
import { MfaEnrollModal, MfaBadge } from './MfaEnrollModal';
import { MfaPasswordConfirmModal } from './MfaPasswordConfirmModal';
import type { NotificationCategory } from '@/types/notifications';
import type { NotificationChannel } from '@/types/settings';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(10, 'Must be at least 10 characters'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'DOCUMENT_EXPIRY',
  'LEAVE',
  'ATTENDANCE',
  'OVERTIME',
  'PAYROLL',
  'SECURITY',
  'WORKFORCE',
  'SYSTEM',
];
const NOTIFICATION_CHANNELS: NotificationChannel[] = ['IN_APP', 'EMAIL'];

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

function PasswordCard() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: PasswordFormValues) =>
      settingsApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => reset({ currentPassword: '', newPassword: '', confirmPassword: '' }),
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Password</h2>
      <p className="mt-1 text-sm text-slate-500">Choose a strong password you don't use anywhere else.</p>
      <form
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {errors.root && (
          <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error sm:col-span-3">
            {errors.root.message}
          </div>
        )}
        {mutation.isSuccess && !errors.root && (
          <div className="rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 sm:col-span-3">
            Password updated.
          </div>
        )}
        <Input
          type="password"
          label="Current password"
          autoComplete="current-password"
          {...register('currentPassword')}
          error={errors.currentPassword?.message}
        />
        <Input
          type="password"
          label="New password"
          autoComplete="new-password"
          {...register('newPassword')}
          error={errors.newPassword?.message}
        />
        <Input
          type="password"
          label="Confirm new password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />
        <div className="flex items-end sm:col-span-3 sm:justify-end">
          <Button type="submit" isLoading={isSubmitting || mutation.isPending}>
            Update password
          </Button>
        </div>
      </form>
    </div>
  );
}

function TwoFactorCard({ mfaEnabled }: { mfaEnabled: boolean }) {
  const [showEnroll, setShowEnroll] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'disable' | 'regenerate' | null>(null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-semibold text-slate-900">Two-factor authentication</h2>
          <MfaBadge enabled={mfaEnabled} />
        </div>
        {mfaEnabled ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmMode('regenerate')}>
              Regenerate backup codes
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmMode('disable')}>
              Disable
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setShowEnroll(true)}>
            <ShieldCheck className="size-4" />
            Enable
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-500">
        {mfaEnabled
          ? 'A 6-digit code from your authenticator app is required every time you sign in, in addition to your password.'
          : 'Add a second step to sign-in using an authenticator app (Google Authenticator, Authy, 1Password, etc.) — recommended for every account, essential for Admin and Finance.'}
      </p>

      <MfaEnrollModal open={showEnroll} onClose={() => setShowEnroll(false)} />
      <MfaPasswordConfirmModal
        open={confirmMode !== null}
        mode={confirmMode}
        onClose={() => setConfirmMode(null)}
      />
    </div>
  );
}

function SessionsCard() {
  const queryClient = useQueryClient();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['settings', 'sessions'],
    queryFn: settingsApi.listSessions,
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => settingsApi.revokeSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'sessions'] }),
    onError: (error) => setErrorMessage(getApiErrorMessage(error)),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => settingsApi.revokeAllOtherSessions(refreshToken ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'sessions'] });
      setConfirmRevokeAll(false);
    },
    onError: (error) => setErrorMessage(getApiErrorMessage(error)),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Active sessions</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setConfirmRevokeAll(true)}
          disabled={!sessions || sessions.length <= 1}
        >
          <LogOut className="size-4" />
          Sign out other sessions
        </Button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Devices and browsers currently signed in to your account. This device stays signed in.
      </p>

      {errorMessage && (
        <div className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errorMessage}</div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
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
                  {session.createdByIp ?? 'Unknown IP'} · signed in {timeAgo(session.createdAt)}
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
        title="Sign out other sessions?"
        description="Every session except this one will stop renewing. Other devices will need to log in again."
        confirmLabel="Sign out others"
        danger
        isLoading={revokeAllMutation.isPending}
        onConfirm={() => revokeAllMutation.mutate()}
        onCancel={() => setConfirmRevokeAll(false)}
      />
    </div>
  );
}

function NotificationsCard({
  preferences,
}: {
  preferences: Array<{ category: NotificationCategory; channel: NotificationChannel; enabled: boolean }>;
}) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function isEnabled(category: NotificationCategory, channel: NotificationChannel): boolean {
    const found = preferences.find((p) => p.category === category && p.channel === channel);
    return found ? found.enabled : true; // unset pairs default to on
  }

  const mutation = useMutation({
    mutationFn: (next: Array<{ category: NotificationCategory; channel: NotificationChannel; enabled: boolean }>) =>
      settingsApi.updateNotificationPreferences(next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
    onError: (error) => setErrorMessage(getApiErrorMessage(error)),
  });

  function toggle(category: NotificationCategory, channel: NotificationChannel, enabled: boolean) {
    mutation.mutate([{ category, channel, enabled }]);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
      <p className="mt-1 text-sm text-slate-500">
        Choose which categories of activity notify you, and how.
      </p>

      {errorMessage && (
        <div className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errorMessage}</div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase text-slate-500">
              <th className="py-2">Category</th>
              <th className="w-24 py-2 text-center">In-app</th>
              <th className="w-24 py-2 text-center">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {NOTIFICATION_CATEGORIES.map((category) => (
              <tr key={category}>
                <td className="py-2.5 text-slate-700">{NOTIFICATION_CATEGORY_LABELS[category]}</td>
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <td key={channel} className="py-2.5 text-center">
                    <Toggle
                      size="sm"
                      checked={isEnabled(category, channel)}
                      onChange={(next) => toggle(category, channel, next)}
                      label={`${NOTIFICATION_CATEGORY_LABELS[category]} via ${channel === 'IN_APP' ? 'in-app' : 'email'}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  if (isLoading || !settings) {
    return <p className="text-slate-400">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account, security, and notification preferences.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <UserRound className="size-5" />
            </span>
            <div>
              <p className="font-medium text-slate-900">
                {settings.employee ? `${settings.employee.firstName} ${settings.employee.lastName}` : settings.email}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <Mail className="size-3.5" />
                {settings.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {settings.roles.map((r) => (
              <StatusBadge key={r.code} tone="info">
                {ROLE_LABELS[r.code]}
              </StatusBadge>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
          {settings.employee && (
            <div>
              <p className="text-slate-400">Department / Position</p>
              <p className="mt-0.5 text-slate-700">
                {settings.employee.department?.name ?? '—'} · {settings.employee.position?.title ?? '—'}
              </p>
            </div>
          )}
          <div>
            <p className="flex items-center gap-1 text-slate-400">
              <Building2 className="size-3.5" /> Organization
            </p>
            <p className="mt-0.5 text-slate-700">{settings.organization.name}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-slate-400">
              <KeyRound className="size-3.5" /> Password last changed
            </p>
            <p className="mt-0.5 text-slate-700">
              {settings.passwordChangedAt ? new Date(settings.passwordChangedAt).toLocaleDateString() : 'Never'}
            </p>
          </div>
        </div>
      </div>

      <PasswordCard />
      <TwoFactorCard mfaEnabled={settings.mfaEnabled} />
      <SessionsCard />
      <NotificationsCard preferences={settings.notificationPreferences} />
    </div>
  );
}
