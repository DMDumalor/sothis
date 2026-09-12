import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { compensationApi } from '@/lib/compensation-api';
import { getApiErrorMessage } from '@/lib/api-client';

export function CompensationPanel({ employeeId }: { employeeId: string }) {
  const [showAdd, setShowAdd] = useState(false);

  const { data: history, isLoading } = useQuery({
    queryKey: ['compensation', employeeId],
    queryFn: () => compensationApi.listForEmployee(employeeId),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Salary history, most recent first.</p>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="size-4" /> Record new salary
        </Button>
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {!isLoading && (history?.length ?? 0) === 0 && (
        <p className="text-sm text-slate-400">No compensation on file yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {history?.map((record) => {
          const isCurrent = !record.effectiveTo;
          return (
            <div
              key={record.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {record.currency} {Number(record.baseSalary).toLocaleString()} / month
                </p>
                <p className="text-xs text-slate-500">
                  From {new Date(record.effectiveFrom).toLocaleDateString()}
                  {record.effectiveTo ? ` to ${new Date(record.effectiveTo).toLocaleDateString()}` : ''}
                  {record.salaryStructure ? ` · ${record.salaryStructure.name}` : ''}
                </p>
              </div>
              {isCurrent && <StatusBadge tone="success">Current</StatusBadge>}
            </div>
          );
        })}
      </div>

      <AddCompensationModal open={showAdd} onClose={() => setShowAdd(false)} employeeId={employeeId} />
    </div>
  );
}

const schema = z.object({
  baseSalary: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, 'Enter a valid amount')
    .refine((v) => Number(v) > 0, 'Must be greater than zero'),
  effectiveFrom: z.string().min(1, 'Effective date is required'),
  salaryStructureId: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

function AddCompensationModal({
  open,
  onClose,
  employeeId,
}: {
  open: boolean;
  onClose: () => void;
  employeeId: string;
}) {
  const queryClient = useQueryClient();

  const { data: structures } = useQuery({
    queryKey: ['salary-structures'],
    queryFn: compensationApi.listSalaryStructures,
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
    defaultValues: { baseSalary: '', effectiveFrom: '', salaryStructureId: '' },
  });

  useEffect(() => {
    if (open) reset({ baseSalary: '', effectiveFrom: '', salaryStructureId: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      compensationApi.create({
        employeeId,
        baseSalary: Number(values.baseSalary),
        effectiveFrom: values.effectiveFrom,
        salaryStructureId: values.salaryStructureId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compensation', employeeId] });
      onClose();
    },
    onError: (error) => setError('root', { message: getApiErrorMessage(error) }),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record new salary"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="compensation-form" type="submit" isLoading={isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="compensation-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {errors.root && (
          <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{errors.root.message}</div>
        )}
        <Input label="Base salary (GHS / month)" {...register('baseSalary')} error={errors.baseSalary?.message} />
        <Input
          type="date"
          label="Effective from"
          {...register('effectiveFrom')}
          error={errors.effectiveFrom?.message}
        />
        <Select label="Salary structure (optional)" {...register('salaryStructureId')}>
          <option value="">None</option>
          {structures?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </form>
    </Modal>
  );
}
