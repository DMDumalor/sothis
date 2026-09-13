import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { usersApi } from '@/lib/users-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/nav-config';
import type { RoleCode } from '@/types/auth';
import type { UserListItem } from '@/types/users';

const ROLE_OPTIONS: RoleCode[] = ['ADMIN', 'HR', 'DEPARTMENT_HEAD', 'FINANCE', 'DG', 'EMPLOYEE'];

/**
 * Keyed by user.id from the parent (see below), so this remounts — and
 * re-derives `selected` from the freshly-opened user via useState's
 * initializer — every time a different user is being edited, instead of
 * syncing state from props inside an effect.
 */
function EditRolesForm({ onClose, user }: { onClose: () => void; user: UserListItem }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RoleCode[]>(() => user.userRoles.map((ur) => ur.role.code));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => usersApi.updateRoles(user.id, selected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (error) => setErrorMessage(getApiErrorMessage(error)),
  });

  const toggle = (code: RoleCode) => {
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit roles — ${user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user.email}`}
      description="A user must keep at least one role. The last active administrator cannot lose the Admin role."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            isLoading={mutation.isPending}
            disabled={selected.length === 0}
          >
            Save roles
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {errorMessage && (
          <div className="mb-1 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errorMessage}</div>
        )}
        {ROLE_OPTIONS.map((code) => (
          <label
            key={code}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(code)}
              onChange={() => toggle(code)}
              className="size-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/40"
            />
            <span className="text-sm font-medium text-slate-800">{ROLE_LABELS[code]}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

export function UserRolesModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: UserListItem | null;
}) {
  if (!open || !user) return null;
  return <EditRolesForm key={user.id} onClose={onClose} user={user} />;
}
