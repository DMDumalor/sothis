import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { positionsApi } from '@/lib/positions-api';
import { departmentsApi } from '@/lib/departments-api';
import { getApiErrorMessage } from '@/lib/api-client';
import type { Position } from '@/types/org';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  code: z.string().trim().min(1, 'Code is required').max(30),
  departmentId: z.string().optional().or(z.literal('')),
  // Kept as a plain string here (native number inputs already emit
  // strings) and parsed to a number only when building the API payload —
  // this avoids zod's input/output type split fighting react-hook-form's
  // resolver typing for an optional coerced field.
  level: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), 'Level must be a whole number ≥ 0'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function PositionFormModal({
  open,
  onClose,
  position,
}: {
  open: boolean;
  onClose: () => void;
  position?: Position | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!position;

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
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
    defaultValues: { title: '', code: '', departmentId: '', level: '', description: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      title: position?.title ?? '',
      code: position?.code ?? '',
      departmentId: position?.departmentId ?? '',
      level: position?.level != null ? String(position.level) : '',
      description: position?.description ?? '',
    });
  }, [open, position, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title,
        code: values.code,
        departmentId: values.departmentId || undefined,
        level: values.level ? Number(values.level) : undefined,
        description: values.description || undefined,
      };
      return isEdit ? positionsApi.update(position!.id, payload) : positionsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      onClose();
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit position' : 'Add position'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="position-form" type="submit" isLoading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create position'}
          </Button>
        </>
      }
    >
      <form
        id="position-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {errors.root && (
          <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">
            {errors.root.message}
          </div>
        )}
        <Input label="Title" {...register('title')} error={errors.title?.message} />
        <Input label="Code" {...register('code')} error={errors.code?.message} />
        <Select label="Department" {...register('departmentId')}>
          <option value="">— None —</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Input
          label="Level"
          type="number"
          min={0}
          {...register('level')}
          error={errors.level?.message}
          hint="Seniority level, lower is more junior"
        />
        <Input label="Description" {...register('description')} error={errors.description?.message} />
      </form>
    </Modal>
  );
}
