import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { attendanceApi } from '@/lib/attendance-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { ATTENDANCE_STATUS_LABELS } from '@/lib/org-labels';
import type { AttendanceRecord } from '@/types/time';

const schema = z.object({
  clockIn: z.string().optional().or(z.literal('')),
  clockOut: z.string().optional().or(z.literal('')),
  status: z.string().optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

/** ISO timestamp -> value for <input type="datetime-local"> (local time, no timezone suffix). */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AttendanceCorrectionModal({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
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
    defaultValues: { clockIn: '', clockOut: '', status: '', notes: '' },
  });

  useEffect(() => {
    if (!open || !record) return;
    reset({
      clockIn: toLocalInputValue(record.clockIn),
      clockOut: toLocalInputValue(record.clockOut),
      status: record.status,
      notes: record.notes ?? '',
    });
  }, [open, record, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!record) throw new Error('No record selected');
      return attendanceApi.correct(record.id, {
        clockIn: values.clockIn ? new Date(values.clockIn).toISOString() : undefined,
        clockOut: values.clockOut ? new Date(values.clockOut).toISOString() : undefined,
        status: (values.status || undefined) as AttendanceRecord['status'] | undefined,
        notes: values.notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      onClose();
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  });

  if (!record) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Correct attendance record"
      description={`${record.employee.firstName} ${record.employee.lastName} · ${new Date(record.date).toLocaleDateString()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="attendance-correction-form" type="submit" isLoading={isSubmitting}>
            Save changes
          </Button>
        </>
      }
    >
      <form
        id="attendance-correction-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {errors.root && (
          <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errors.root.message}</div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input type="datetime-local" label="Clock in" {...register('clockIn')} error={errors.clockIn?.message} />
          <Input type="datetime-local" label="Clock out" {...register('clockOut')} error={errors.clockOut?.message} />
        </div>
        <Select label="Status" {...register('status')} error={errors.status?.message}>
          {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input label="Notes" {...register('notes')} error={errors.notes?.message} />
      </form>
    </Modal>
  );
}
