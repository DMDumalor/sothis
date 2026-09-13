import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, ShieldAlert, Users } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Toggle } from '@/components/ui/Toggle';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { rolesApi } from '@/lib/roles-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/nav-config';
import type { PermissionScope } from '@/types/roles';
import type { RoleCode } from '@/types/auth';

const SCOPE_LABELS: Record<PermissionScope, string> = {
  OWN: 'Own records',
  DEPARTMENT: 'Department',
  TENANT: 'Whole organization',
};

// Removing either of these from Admin is blocked server-side too (it would
// lock the organization out of its own permission console) — disabling the
// toggle here just avoids a round-trip to learn that.
const ADMIN_LOCKED_PERMISSIONS = new Set(['role.manage', 'permission.manage']);

export function RolesPermissionsPage() {
  const queryClient = useQueryClient();
  const [activeRoleCode, setActiveRoleCode] = useState<RoleCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', 'list'],
    queryFn: rolesApi.list,
  });

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ['roles', 'permission-catalog'],
    queryFn: rolesApi.permissionCatalog,
  });

  const activeRole = useMemo(() => {
    if (!roles || roles.length === 0) return undefined;
    return roles.find((r) => r.code === activeRoleCode) ?? roles[0];
  }, [roles, activeRoleCode]);

  const grantedByCode = useMemo(() => {
    const map = new Map<string, PermissionScope>();
    activeRole?.permissions.forEach((p) => map.set(p.code, p.scope));
    return map;
  }, [activeRole]);

  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, typeof catalog>();
    (catalog ?? []).forEach((entry) => {
      const list = groups.get(entry.module) ?? [];
      list.push(entry);
      groups.set(entry.module, list as typeof catalog);
    });
    return Array.from(groups.entries());
  }, [catalog]);

  const updateMutation = useMutation({
    mutationFn: ({
      permissionCode,
      granted,
      scope,
    }: {
      permissionCode: string;
      granted: boolean;
      scope?: PermissionScope;
    }) => rolesApi.updatePermission(activeRole!.id, permissionCode, { granted, scope }),
    onMutate: ({ permissionCode }) => setPendingPermission(permissionCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'list'] });
      setPendingPermission(null);
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error));
      setPendingPermission(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => rolesApi.resetToDefault(activeRole!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'list'] });
      setConfirmReset(false);
    },
    onError: (error) => setErrorMessage(getApiErrorMessage(error)),
  });

  if (rolesLoading || catalogLoading || !activeRole) {
    return <p className="text-slate-400">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Roles & Permissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Roles are fixed by the platform; fine-tune what each one can access and at what scope.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-2.5 text-sm text-brand-error">
          {errorMessage}
          <button onClick={() => setErrorMessage(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}

      <Tabs
        tabs={(roles ?? []).map((r) => ({ key: r.code, label: ROLE_LABELS[r.code] }))}
        active={activeRole.code}
        onChange={(k) => setActiveRoleCode(k as RoleCode)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <ShieldAlert className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-slate-900">{ROLE_LABELS[activeRole.code]}</p>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <Users className="size-3.5" /> {activeRole.userCount} user{activeRole.userCount === 1 ? '' : 's'} assigned
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setConfirmReset(true)}>
          <RotateCcw className="size-4" />
          Reset to default
        </Button>
      </div>

      <div className="flex flex-col gap-5">
        {groupedCatalog.map(([module, entries]) => (
          <div key={module} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{module}</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {entries?.map((entry) => {
                const scope = grantedByCode.get(entry.code);
                const granted = scope !== undefined;
                const isLocked = activeRole.code === 'ADMIN' && ADMIN_LOCKED_PERMISSIONS.has(entry.code) && granted;
                const isPending = pendingPermission === entry.code && updateMutation.isPending;

                return (
                  <div key={entry.code} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-[220px]">
                      <p className="text-sm font-medium text-slate-800">{entry.description}</p>
                      <p className="text-xs text-slate-400">{entry.code}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {granted && (
                        <div className="w-44">
                          <Select
                            value={scope}
                            disabled={isPending}
                            onChange={(e) =>
                              updateMutation.mutate({
                                permissionCode: entry.code,
                                granted: true,
                                scope: e.target.value as PermissionScope,
                              })
                            }
                          >
                            {(Object.entries(SCOPE_LABELS) as [PermissionScope, string][]).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}
                      <Toggle
                        checked={granted}
                        disabled={isPending || isLocked}
                        label={`Toggle ${entry.description}`}
                        onChange={(next) =>
                          updateMutation.mutate({
                            permissionCode: entry.code,
                            granted: next,
                            scope: next ? 'TENANT' : undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={`Reset ${ROLE_LABELS[activeRole.code]} to defaults?`}
        description="This replaces every permission and scope currently granted to this role with the platform's default set."
        confirmLabel="Reset"
        danger
        isLoading={resetMutation.isPending}
        onConfirm={() => resetMutation.mutate()}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
