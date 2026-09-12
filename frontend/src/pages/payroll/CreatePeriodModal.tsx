import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { payrollApi } from '@/lib/payroll-api';
import { getApiErrorMessage } from '@/lib/api-client';

const schema = z
  .object({
    name: z.string().trim().max(60).optional().or(z.literal('')),
    periodStart: z.string().min(1, 'Start date is required'),
    periodEnd: z.string().min(1, 'End date is required'),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: 'End date must be on or after the start date',
    path: ['periodEnd'],
  });

type FormValues = z.infer<typeof schema>;

export function CreatePeriodModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', periodStart: '', periodEnd: '' },
  });

  useEffect(() => {
    if (open) reset({ name: '', periodStart: '', periodEnd: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      payrollApi.createPeriod({
        name: values.name || undefined,
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
      }),
    onSuccess: (period) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] });
      onClose();
      navigate(`/payroll/${period.id}`);
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New payroll period"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="payroll-period-form" type="submit" isLoading={isSubmitting}>
            Create period
          </Button>
        </>
      }
    >
      <form
        id="payroll-period-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {errors.root && (
          <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errors.root.message}</div>
        )}
        <Input label="Name (optional)" placeholder="e.g. October 2026" {...register('name')} error={errors.name?.message} />
        <div className="grid grid-cols-2 gap-4">
          <Input type="date" label="Period start" {...register('periodStart')} error={errors.periodStart?.message} />
          <Input type="date" label="Period end" {...register('periodEnd')} error={errors.periodEnd?.message} />
        </div>
      </form>
    </Modal>
  );
}
