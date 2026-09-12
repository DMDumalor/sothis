import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { payrollApi } from '@/lib/payroll-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { PAYMENT_METHOD_LABELS } from '@/lib/org-labels';
import type { PaymentMethod } from '@/types/payroll';

const schema = z.object({
  method: z.string().min(1, 'Select a payment method'),
  reference: z.string().trim().max(100).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function MarkPaidModal({
  open,
  onClose,
  payrollId,
  periodId,
}: {
  open: boolean;
  onClose: () => void;
  payrollId: string | null;
  periodId: string;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { method: 'BANK_TRANSFER', reference: '' },
  });

  useEffect(() => {
    if (open) reset({ method: 'BANK_TRANSFER', reference: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!payrollId) throw new Error('No payroll selected');
      return payrollApi.markPaid(payrollId, {
        method: values.method as PaymentMethod,
        reference: values.reference || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'period', periodId] });
      onClose();
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark as paid"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="mark-paid-form" type="submit" isLoading={isSubmitting}>
            Confirm payment
          </Button>
        </>
      }
    >
      <form
        id="mark-paid-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {errors.root && (
          <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errors.root.message}</div>
        )}
        <Select label="Payment method" {...register('method')} error={errors.method?.message}>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input label="Reference (optional)" {...register('reference')} error={errors.reference?.message} />
      </form>
    </Modal>
  );
}
