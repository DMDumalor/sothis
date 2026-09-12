import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { overtimeApi } from '@/lib/overtime-api';
import { getApiErrorMessage } from '@/lib/api-client';

// `hours` is kept as a string in the form schema rather than z.coerce.number():
// zod's coerce creates a mismatched input ("unknown")/output (number) type pair
// that breaks react-hook-form's zodResolver typing (see PositionFormModal for
// the same issue with a numeric field). Validated via regex here and parsed
// with Number() only when building the API payload.
const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  hours: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, 'Enter a number of hours')
    .refine((v) => Number(v) >= 0.25 && Number(v) <= 24, 'Must be between 0.25 and 24 hours'),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function OvertimeFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().slice(0, 10), hours: '1', reason: '' },
  });

  useEffect(() => {
    if (open) reset({ date: new Date().toISOString().slice(0, 10), hours: '1', reason: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      overtimeApi.create({ date: values.date, hours: Number(values.hours), reason: values.reason || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime'] });
      onClose();
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit overtime"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="overtime-form" type="submit" isLoading={isSubmitting}>
            Submit
          </Button>
        </>
      }
    >
      <form
        id="overtime-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {errors.root && (
          <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errors.root.message}</div>
        )}
        <Input type="date" label="Date" max={new Date().toISOString().slice(0, 10)} {...register('date')} error={errors.date?.message} />
        <Input type="number" step="0.25" min="0.25" max="24" label="Hours" {...register('hours')} error={errors.hours?.message} />
        <Input label="Reason (optional)" {...register('reason')} error={errors.reason?.message} />
      </form>
    </Modal>
  );
}
