import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, type Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuthStore } from '@/stores/auth-store';
import { employeesApi } from '@/lib/employees-api';
import { departmentsApi } from '@/lib/departments-api';
import { canManageEmployees } from '@/lib/ui-permissions';
import { EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_STATUS_TONE, EMPLOYMENT_TYPE_LABELS } from '@/lib/org-labels';
import type { EmployeeListItem, EmploymentStatus } from '@/types/org';
import { EmployeeFormModal } from './EmployeeFormModal';

const PAGE_SIZE = 20;

export function EmployeeDirectoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage = canManageEmployees(roles);

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState(searchParams.get('departmentId') ?? '');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list });

  const { data, isLoading } = useQuery({
    queryKey: ['employees', { search, departmentId, status, page }],
    queryFn: () =>
      employeesApi.list({
        search: search || undefined,
        departmentId: departmentId || undefined,
        status: (status || undefined) as EmploymentStatus | undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<EmployeeListItem>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.firstName} {row.lastName}
          </p>
          <p className="text-xs text-slate-500">{row.employeeCode}</p>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (row) => row.email },
    { key: 'department', header: 'Department', render: (row) => row.department?.name ?? '—' },
    { key: 'position', header: 'Position', render: (row) => row.position?.title ?? '—' },
    {
      key: 'employmentType',
      header: 'Type',
      render: (row) => EMPLOYMENT_TYPE_LABELS[row.employmentType],
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge tone={EMPLOYMENT_STATUS_TONE[row.employmentStatus]}>
          {EMPLOYMENT_STATUS_LABELS[row.employmentStatus]}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data ? `${data.pagination.total} employee${data.pagination.total === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" />
            Add employee
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search name, email, or code…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <div className="w-48">
            <Select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All departments</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([value, label]) => (
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
          emptyMessage="No employees match your filters."
          onRowClick={(row) => navigate(`/employees/${row.id}`)}
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

      <EmployeeFormModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
