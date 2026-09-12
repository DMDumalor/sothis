import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { employeesApi } from '@/lib/employees-api';
import { departmentsApi } from '@/lib/departments-api';
import { positionsApi } from '@/lib/positions-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/org-labels';
import type { EmployeeDetail } from '@/types/org';

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  departmentId: z.string().optional().or(z.literal('')),
  positionId: z.string().optional().or(z.literal('')),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']),
  startDate: z.string().min(1, 'Start date is required'),
});

type FormValues = z.infer<typeof schema>;

interface EmployeeFormModalProps {
  open: boolean;
  onClose: () => void;
  employee?: EmployeeDetail | null;
}

export function EmployeeFormModal({ open, onClose, employee }: EmployeeFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!employee;

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
    enabled: open,
  });
  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.list(),
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
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      departmentId: '',
      positionId: '',
      employmentType: 'FULL_TIME',
      startDate: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      firstName: employee?.firstName ?? '',
      lastName: employee?.lastName ?? '',
      email: employee?.email ?? '',
      phone: employee?.phone ?? '',
      departmentId: employee?.department?.id ?? '',
      positionId: employee?.position?.id ?? '',
      employmentType: employee?.employmentType ?? 'FULL_TIME',
      startDate: employee?.startDate ? employee.startDate.slice(0, 10) : '',
    });
  }, [open, employee, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone || undefined,
        departmentId: values.departmentId || undefined,
        positionId: values.positionId || undefined,
        employmentType: values.employmentType,
        startDate: values.startDate,
      };
      return isEdit ? employeesApi.update(employee!.id, payload) : employeesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['employee', employee!.id] });
      onClose();
    },
    onError: (error) => {
      setError('root', { message: getApiErrorMessage(error) });
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit employee' : 'Add employee'}
      description={isEdit ? `${employee!.firstName} ${employee!.lastName}` : 'Create a new employee record'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="employee-form" type="submit" isLoading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create employee'}
          </Button>
        </>
      }
    >
      <form
        id="employee-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {errors.root && (
          <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">
            {errors.root.message}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="First name" {...register('firstName')} error={errors.firstName?.message} />
          <Input label="Last name" {...register('lastName')} error={errors.lastName?.message} />
        </div>
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Phone" {...register('phone')} error={errors.phone?.message} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Department" {...register('departmentId')}>
            <option value="">— None —</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select label="Position" {...register('positionId')}>
            <option value="">— None —</option>
            {positions?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Employment type" {...register('employmentType')}>
            {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Start date"
            type="date"
            {...register('startDate')}
            error={errors.startDate?.message}
          />
        </div>
      </form>
    </Modal>
  );
}
