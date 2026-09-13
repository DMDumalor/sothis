import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Upload, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { usersApi } from '@/lib/users-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { parseCsvWithHeader, toCsv, downloadTextFile } from '@/lib/csv';
import { ROLE_LABELS } from '@/lib/nav-config';
import type { RoleCode } from '@/types/auth';
import type { BulkInviteResult, EmployeeWithoutAccount } from '@/types/users';

const VALID_ROLES = new Set<RoleCode>(['ADMIN', 'HR', 'DEPARTMENT_HEAD', 'FINANCE', 'DG', 'EMPLOYEE']);

interface PreviewRow {
  rowNumber: number;
  employeeCode: string;
  roleInput: string;
  email?: string;
  matchedEmployee?: EmployeeWithoutAccount;
  resolvedRole?: RoleCode;
  error?: string;
}

function buildPreview(records: Array<Record<string, string>>, employees: EmployeeWithoutAccount[]): PreviewRow[] {
  const byCode = new Map(employees.map((e) => [e.employeeCode.trim().toLowerCase(), e]));
  const byEmail = new Map(employees.map((e) => [e.email.trim().toLowerCase(), e]));

  return records.map((record, index) => {
    const employeeCode = record['employeecode'] ?? record['employee_code'] ?? record['code'] ?? '';
    const roleInput = (record['role'] ?? record['rolecode'] ?? '').trim();
    const email = record['email']?.trim() || undefined;

    const matchedEmployee =
      byCode.get(employeeCode.trim().toLowerCase()) ??
      (email ? byEmail.get(email.toLowerCase()) : undefined);

    const resolvedRole = VALID_ROLES.has(roleInput.toUpperCase() as RoleCode)
      ? (roleInput.toUpperCase() as RoleCode)
      : undefined;

    let error: string | undefined;
    if (!employeeCode && !email) {
      error = 'Missing employee code';
    } else if (!matchedEmployee) {
      error = 'No matching employee without an account';
    } else if (!roleInput) {
      error = 'Missing role';
    } else if (!resolvedRole) {
      error = `Unrecognized role "${roleInput}"`;
    }

    return {
      rowNumber: index + 2, // header is row 1
      employeeCode,
      roleInput,
      email,
      matchedEmployee,
      resolvedRole,
      error,
    };
  });
}

export function BulkInviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkInviteResult | null>(null);

  const { data: employees } = useQuery({
    queryKey: ['users', 'employees-without-account'],
    queryFn: usersApi.listEmployeesWithoutAccount,
    enabled: open,
  });

  const validRows = useMemo(() => rows.filter((r) => !r.error && r.matchedEmployee && r.resolvedRole), [rows]);

  const mutation = useMutation({
    mutationFn: () =>
      usersApi.bulkInvite(
        validRows.map((r) => ({
          employeeId: r.matchedEmployee!.id,
          roleCode: r.resolvedRole!,
          email: r.email,
        })),
      ),
    onSuccess: (result) => {
      setResults(result);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => setParseError(getApiErrorMessage(error)),
  });

  function handleFile(file: File) {
    setParseError(null);
    setResults(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const records = parseCsvWithHeader(text);
        if (records.length === 0) {
          setParseError('The file has no data rows.');
          setRows([]);
          return;
        }
        setRows(buildPreview(records, employees ?? []));
      } catch {
        setParseError('Could not read that file as CSV.');
        setRows([]);
      }
    };
    reader.onerror = () => setParseError('Could not read that file.');
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const example = employees?.[0];
    const csv = toCsv([
      ['employeeCode', 'role', 'email'],
      [example?.employeeCode ?? 'EMP-00001', 'EMPLOYEE', ''],
    ]);
    downloadTextFile('bulk-invite-template.csv', csv);
  }

  function handleClose() {
    setRows([]);
    setParseError(null);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }

  const invalidCount = rows.length - validRows.length;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Bulk invite from CSV"
      description="Upload a CSV with employeeCode, role, and an optional email override — one row per invitation."
      size="lg"
      footer={
        results ? (
          <Button onClick={handleClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              isLoading={mutation.isPending}
              disabled={validRows.length === 0}
            >
              Send {validRows.length || ''} invitation{validRows.length === 1 ? '' : 's'}
            </Button>
          </>
        )
      }
    >
      {!results && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" />
              Choose CSV file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              <Download className="size-4" />
              Download template
            </Button>
          </div>

          {parseError && (
            <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{parseError}</div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{rows.length}</span> rows parsed
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="size-3.5" />
                    {invalidCount} will be skipped
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">Row</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">Employee</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">Role</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                        <td className="px-3 py-2">
                          {row.matchedEmployee ? (
                            <span className="text-slate-800">
                              {row.matchedEmployee.firstName} {row.matchedEmployee.lastName}
                            </span>
                          ) : (
                            <span className="text-slate-500">{row.employeeCode || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {row.resolvedRole ? ROLE_LABELS[row.resolvedRole] : row.roleInput || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {row.error ? (
                            <span className="flex items-center gap-1 text-brand-error">
                              <XCircle className="size-3.5" /> {row.error}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="size-3.5" /> Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {results && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="size-4" /> {results.successCount} sent
            </span>
            {results.failureCount > 0 && (
              <span className="flex items-center gap-1.5 text-brand-error">
                <XCircle className="size-4" /> {results.failureCount} failed
              </span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {results.results.map((r, i) => (
                  <tr key={`${r.employeeId}-${i}`}>
                    <td className="px-3 py-2 text-slate-700">{r.email ?? r.employeeId}</td>
                    <td className="px-3 py-2">
                      {r.success ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="size-3.5" /> Invited
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-brand-error">
                          <XCircle className="size-3.5" /> {r.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
