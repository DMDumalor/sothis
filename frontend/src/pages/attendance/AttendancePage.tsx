import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogIn, LogOut, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Table, type Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/lib/auth-api';
import { attendanceApi } from '@/lib/attendance-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { canClockAttendance, canCorrectAttendance } from '@/lib/ui-permissions';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_TONE } from '@/lib/org-labels';
import type { AttendanceRecord, AttendanceStatus } from '@/types/time';
import { AttendanceCorrectionModal } from './AttendanceCorrectionModal';

const PAGE_SIZE = 15;

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatWorked(minutes: number | null) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function AttendancePage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canCorrect = canCorrectAttendance(roles);
  const canClock = canClockAttendance(roles);
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me });

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'records', { page, status, dateFrom, dateTo }],
    queryFn: () =>
      attendanceApi.list({
        page,
        pageSize: PAGE_SIZE,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const today = new Date().toISOString().slice(0, 10);

  // Independent of the filtered/paginated table below, so changing the
  // table's filters never affects whether the clock-in/out button shows
  // the caller's actual state for today.
  const { data: todayData } = useQuery({
    queryKey: ['attendance', 'today', me?.employee?.id],
    queryFn: () => attendanceApi.list({ employeeId: me!.employee!.id, dateFrom: today, dateTo: today, page: 1, pageSize: 1 }),
    enabled: !!me?.employee && canClock,
  });
  const todayRecord = todayData?.items[0];

  const clockInMutation = useMutation({
    mutationFn: () => attendanceApi.clockIn(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const clockOutMutation = useMutation({
    mutationFn: () => attendanceApi.clockOut(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const columns: Column<AttendanceRecord>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => `${row.employee.firstName} ${row.employee.lastName}`,
    },
    { key: 'date', header: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
    { key: 'clockIn', header: 'Clock in', render: (row) => formatTime(row.clockIn) },
    { key: 'clockOut', header: 'Clock out', render: (row) => formatTime(row.clockOut) },
    { key: 'worked', header: 'Worked', render: (row) => formatWorked(row.workedMinutes) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge tone={ATTENDANCE_STATUS_TONE[row.status]}>{ATTENDANCE_STATUS_LABELS[row.status]}</StatusBadge>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canCorrect && (
          <button
            onClick={() => setEditing(row)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Correct record"
          >
            <Pencil className="size-4" />
          </button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">Clock in/out and review attendance records.</p>
        </div>
        {me?.employee && canClock && (
          <div className="flex items-center gap-2">
            {(clockInMutation.isError || clockOutMutation.isError) && (
              <p className="text-sm text-brand-error">
                {getApiErrorMessage(clockInMutation.error ?? clockOutMutation.error)}
              </p>
            )}
            {!todayRecord?.clockIn ? (
              <Button isLoading={clockInMutation.isPending} onClick={() => clockInMutation.mutate()}>
                <LogIn className="size-4" /> Clock in
              </Button>
            ) : !todayRecord?.clockOut ? (
              <Button variant="secondary" isLoading={clockOutMutation.isPending} onClick={() => clockOutMutation.mutate()}>
                <LogOut className="size-4" /> Clock out
              </Button>
            ) : (
              <StatusBadge tone="success">Clocked out for today</StatusBadge>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <div className="w-40">
            <Input
              type="date"
              label="From"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-40">
            <Input
              type="date"
              label="To"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-44">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as AttendanceStatus | '');
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Table
          columns={columns}
          data={data?.items ?? []}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No attendance records found."
        />

        {data && (
          <Pagination
            page={data.pagination.page}
            pageSize={data.pagination.pageSize}
            total={data.pagination.total}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      <AttendanceCorrectionModal open={!!editing} onClose={() => setEditing(null)} record={editing} />
    </div>
  );
}
