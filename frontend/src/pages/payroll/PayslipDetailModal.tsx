import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { payrollApi } from '@/lib/payroll-api';

function money(v: string) {
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PayslipDetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: payslip, isLoading } = useQuery({
    queryKey: ['payslip', id],
    queryFn: () => payrollApi.getPayslip(id!),
    enabled: !!id,
  });

  return (
    <Modal open={!!id} onClose={onClose} title="Payslip" size="md">
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-brand-primary" />
        </div>
      )}
      {payslip && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {payslip.payroll.employee.firstName} {payslip.payroll.employee.lastName}
            </p>
            <p className="text-sm text-slate-500">
              {payslip.payroll.employee.employeeCode} · {payslip.payroll.payrollPeriod.name}
            </p>
            <p className="text-xs text-slate-400">Issued {new Date(payslip.issuedAt).toLocaleDateString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-slate-200 p-4 text-sm">
            <span className="text-slate-500">Base salary</span>
            <span className="text-right font-medium text-slate-800">{money(payslip.payroll.baseSalary)}</span>

            <span className="text-slate-500">Overtime pay</span>
            <span className="text-right font-medium text-slate-800">{money(payslip.payroll.overtimePay)}</span>

            <span className="text-slate-500">Allowances</span>
            <span className="text-right font-medium text-slate-800">{money(payslip.payroll.totalAllowances)}</span>

            <span className="border-t border-slate-200 pt-2 text-slate-500">Gross pay</span>
            <span className="border-t border-slate-200 pt-2 text-right font-medium text-slate-800">
              {money(payslip.payroll.grossPay)}
            </span>

            <span className="text-slate-500">Deductions</span>
            <span className="text-right font-medium text-red-600">-{money(payslip.payroll.totalDeductions)}</span>

            <span className="border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">Net pay</span>
            <span className="border-t border-slate-200 pt-2 text-right text-base font-semibold text-brand-primary">
              {money(payslip.payroll.netPay)}
            </span>
          </div>

          {(payslip.payroll.deductions?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Deduction breakdown</p>
              <div className="flex flex-col gap-1 text-sm text-slate-600">
                {payslip.payroll.deductions!.map((d) => (
                  <div key={d.id} className="flex justify-between">
                    <span>{d.label}</span>
                    <span>{money(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
