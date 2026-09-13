import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { usersApi } from '@/lib/users-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/nav-config';
import type { RoleCode } from '@/types/auth';

const ROLE_OPTIONS: RoleCode[] = ['ADMIN', 'HR', 'DEPARTMENT_HEAD', 'FINANCE', 'DG', 'EMPLOYEE'];

const schema = z.object({
  employeeId: z.string().min(1, 'Select an employee'),
  roleCode: z.enum(['ADMIN', 'HR', 'DEPARTMENT_HEAD', 'FINANCE', 'DG', 'EMPLOYEE']),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function InviteUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['users', 'employees-without-account'],
    queryFn: usersApi.listEmployeesWithoutAccount,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { employeeId: '', roleCode: 'EMPLOYEE', email: '' },
  });

  useEffect(() => {
    if (open) reset({ employeeId: '', roleCode: 'EMPLOYEE', email: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      usersApi.inviteUser({
        employeeId: values.employeeId,
        roleCode: values.roleCode as RoleCode,
        email: values.email || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a user"
      description="Only existing employees without an account can be invited."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="invite-user-form" type="submit" isLoading={isSubmitting}>
            Send invitation
          </Button>
        </>
      }
    >
      <form
        id="invite-user-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {errors.root && (
          <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errors.root.message}</div>
        )}

        <Select label="Employee" {...register('employeeId')} error={errors.employeeId?.message}>
          <option value="">{employeesLoading ? 'Loading employees…' : 'Select an employee'}</option>
          {employees?.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName} ({emp.employeeCode})
              {emp.department ? ` · ${emp.department.name}` : ''}
            </option>
          ))}
        </Select>
        {!employeesLoading && employees?.length === 0 && (
          <p className="text-sm text-slate-500">
            Every employee already has an account. Add a new employee first to invite one.
          </p>
        )}

        <Select label="Role" {...register('roleCode')} error={errors.roleCode?.message}>
          {ROLE_OPTIONS.map((code) => (
            <option key={code} value={code}>
              {ROLE_LABELS[code]}
            </option>
          ))}
        </Select>

        <Input
          label="Email override (optional)"
          placeholder="Defaults to the employee's email"
          {...register('email')}
          error={errors.email?.message}
        />
      </form>
    </Modal>
  );
}
