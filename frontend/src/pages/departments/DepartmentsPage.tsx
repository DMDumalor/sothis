import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users, Briefcase, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth-store';
import { departmentsApi } from '@/lib/departments-api';
import { canManageOrgStructure } from '@/lib/ui-permissions';
import type { Department } from '@/types/org';
import { DepartmentFormModal } from './DepartmentFormModal';

export function DepartmentsPage() {
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage = canManageOrgStructure(roles);

  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Departments</h1>
          <p className="mt-1 text-sm text-slate-500">
            {departments ? `${departments.length} department${departments.length === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> Add department
          </Button>
        )}
      </div>

      {isLoading && <p className="text-slate-400">Loading…</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments?.map((dept) => (
          <div
            key={dept.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{dept.name}</h3>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{dept.code}</p>
              </div>
              {canManage && (
                <button
                  onClick={() => setEditing(dept)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={`Edit ${dept.name}`}
                >
                  <Pencil className="size-4" />
                </button>
              )}
            </div>
            {dept.description && <p className="text-sm text-slate-500">{dept.description}</p>}
            {dept.headEmployee && (
              <p className="text-sm text-slate-600">
                Head: {dept.headEmployee.firstName} {dept.headEmployee.lastName}
              </p>
            )}
            <div className="mt-1 flex items-center gap-4 border-t border-slate-100 pt-3 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Users className="size-4" /> {dept._count?.employees ?? 0} employees
              </span>
              <span className="flex items-center gap-1.5">
                <Briefcase className="size-4" /> {dept._count?.positions ?? 0} positions
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-1 w-fit"
              onClick={() => navigate(`/employees?departmentId=${dept.id}`)}
            >
              View employees
            </Button>
          </div>
        ))}
      </div>

      <DepartmentFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      <DepartmentFormModal open={!!editing} onClose={() => setEditing(null)} department={editing} />
    </div>
  );
}
