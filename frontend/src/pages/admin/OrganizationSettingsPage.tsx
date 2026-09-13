import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Building2, UserCheck, MailPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { organizationApi } from '@/lib/organization-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/nav-config';

const schema = z.object({
  name: z.string().trim().min(1, 'Organization name is required').max(200),
  timezone: z.string().trim().min(1, 'Timezone is required').max(100),
  logoUrl: z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const { data: org, isLoading } = useQuery({ queryKey: ['organization'], queryFn: organizationApi.get });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', timezone: '', logoUrl: '' },
  });

  useEffect(() => {
    if (org) {
      reset({ name: org.name, timezone: org.timezone, logoUrl: org.logoUrl ?? '' });
    }
  }, [org, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      organizationApi.update({
        name: values.name,
        timezone: values.timezone,
        logoUrl: values.logoUrl || undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['organization'], updated);
      reset({ name: updated.name, timezone: updated.timezone, logoUrl: updated.logoUrl ?? '' });
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  });

  if (isLoading || !org) {
    return <p className="text-slate-400">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Organization Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Organization code <span className="font-mono font-medium text-slate-700">{org.code}</span> is used at
          login and cannot be changed here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Users} label="Employees" value={org.stats.employeeCount} tone="info" />
        <KpiCard icon={UserCheck} label="Active users" value={org.stats.activeUserCount} tone="success" />
        <KpiCard icon={Building2} label="Departments" value={org.stats.departmentCount} tone="neutral" />
        <KpiCard
          icon={MailPlus}
          label="Pending invitations"
          value={org.stats.pendingInvitationCount}
          tone={org.stats.pendingInvitationCount > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Profile</h2>
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
          >
            {errors.root && (
              <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errors.root.message}</div>
            )}
            <Input label="Organization name" {...register('name')} error={errors.name?.message} />
            <Input
              label="Timezone"
              {...register('timezone')}
              error={errors.timezone?.message}
              hint='IANA timezone, e.g. "Africa/Accra"'
            />
            <Input
              label="Logo URL (optional)"
              {...register('logoUrl')}
              error={errors.logoUrl?.message}
            />
            <div className="flex justify-end">
              <Button type="submit" isLoading={isSubmitting || mutation.isPending} disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Workforce by role</h2>
          <div className="mt-4 flex flex-col gap-2.5">
            {org.stats.roleBreakdown.map((r) => (
              <div key={r.code} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{ROLE_LABELS[r.code]}</span>
                <StatusBadge tone="neutral">{r.userCount}</StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
