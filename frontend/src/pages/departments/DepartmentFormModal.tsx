import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { departmentsApi } from '@/lib/departments-api';
import { getApiErrorMessage } from '@/lib/api-client';
import type { Department } from '@/types/org';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Uppercase letters, numbers, - and _ only'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function DepartmentFormModal({
  open,
  onClose,
  department,
}: {
  open: boolean;
  onClose: () => void;
  department?: Department | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!department;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', code: '', description: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: department?.name ?? '',
      code: department?.code ?? '',
      description: department?.description ?? '',
    });
  }, [open, department, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        code: values.code.toUpperCase(),
        description: values.description || undefined,
      };
      return isEdit ? departmentsApi.update(department!.id, payload) : departmentsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      onClose();
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit department' : 'Add department'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="department-form" type="submit" isLoading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create department'}
          </Button>
        </>
      }
    >
      <form
        id="department-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {errors.root && (
          <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">
            {errors.root.message}
          </div>
        )}
        <Input label="Name" {...register('name')} error={errors.name?.message} />
        <Input
          label="Code"
          {...register('code')}
          error={errors.code?.message}
          hint="Short unique code, e.g. HR, IT, FIN"
          style={{ textTransform: 'uppercase' }}
        />
        <Input label="Description" {...register('description')} error={errors.description?.message} />
      </form>
    </Modal>
  );
}
