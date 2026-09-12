import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { leaveApi } from '@/lib/leave-api';
import { getApiErrorMessage } from '@/lib/api-client';

const schema = z
  .object({
    leaveTypeId: z.string().uuid('Select a leave type'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    reason: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });

type FormValues = z.infer<typeof schema>;

export function LeaveRequestFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave', 'types'],
    queryFn: leaveApi.listTypes,
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
    defaultValues: { leaveTypeId: '', startDate: '', endDate: '', reason: '' },
  });

  useEffect(() => {
    if (open) reset({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      leaveApi.create({
        leaveTypeId: values.leaveTypeId,
        startDate: values.startDate,
        endDate: values.endDate,
        reason: values.reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave', 'balances'] });
      onClose();
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request leave"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="leave-request-form" type="submit" isLoading={isSubmitting}>
            Submit request
          </Button>
        </>
      }
    >
      <form
        id="leave-request-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {errors.root && (
          <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errors.root.message}</div>
        )}
        <Select label="Leave type" {...register('leaveTypeId')} error={errors.leaveTypeId?.message}>
          <option value="">Select a leave type…</option>
          {leaveTypes?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.paid ? '' : '(unpaid)'}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <Input type="date" label="Start date" {...register('startDate')} error={errors.startDate?.message} />
          <Input type="date" label="End date" {...register('endDate')} error={errors.endDate?.message} />
        </div>
        <Input label="Reason (optional)" {...register('reason')} error={errors.reason?.message} />
      </form>
    </Modal>
  );
}
