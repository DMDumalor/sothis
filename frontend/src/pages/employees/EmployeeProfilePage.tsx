import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, Pencil, Building2, Briefcase, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { useAuthStore } from '@/stores/auth-store';
import { employeesApi } from '@/lib/employees-api';
import { canManageEmployees } from '@/lib/ui-permissions';
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_STATUS_TONE,
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
} from '@/lib/org-labels';
import { EmployeeFormModal } from './EmployeeFormModal';
import { EmployeeDocumentsPanel } from './EmployeeDocumentsPanel';

type TabKey = 'overview' | 'contact' | 'emergency' | 'documents';

export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage = canManageEmployees(roles);
  const [tab, setTab] = useState<TabKey>('overview');
  const [showEdit, setShowEdit] = useState(false);

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading…</div>;
  }

  if (!employee) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-500">Employee not found, or you don't have access to view it.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => navigate(-1)}
        className="flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-lg font-semibold text-brand-primary">
            {employee.firstName[0]}
            {employee.lastName[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                {employee.firstName} {employee.lastName}
              </h1>
              <StatusBadge tone={EMPLOYMENT_STATUS_TONE[employee.employmentStatus]}>
                {EMPLOYMENT_STATUS_LABELS[employee.employmentStatus]}
              </StatusBadge>
            </div>
            <p className="text-sm text-slate-500">
              {employee.position?.title ?? 'No position assigned'} · {employee.employeeCode}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-1.5">
                <Mail className="size-4 text-slate-400" /> {employee.email}
              </span>
              {employee.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-4 text-slate-400" /> {employee.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Building2 className="size-4 text-slate-400" /> {employee.department?.name ?? '—'}
              </span>
            </div>
          </div>
        </div>
        {canManage && (
          <Button variant="secondary" onClick={() => setShowEdit(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
        )}
      </div>

      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'contact', label: 'Contact' },
          { key: 'emergency', label: 'Emergency contacts', count: employee.emergencyContacts.length },
          { key: 'documents', label: 'Documents' },
        ]}
        active={tab}
        onChange={(key) => setTab(key as TabKey)}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {tab === 'overview' && (
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field icon={Briefcase} label="Employment type" value={EMPLOYMENT_TYPE_LABELS[employee.employmentType]} />
            <Field icon={Calendar} label="Start date" value={new Date(employee.startDate).toLocaleDateString()} />
            <Field icon={Building2} label="Department" value={employee.department?.name ?? '—'} />
            <Field icon={Briefcase} label="Position" value={employee.position?.title ?? '—'} />
            <Field label="Gender" value={GENDER_LABELS[employee.gender]} />
            <Field
              label="Date of birth"
              value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : '—'}
            />
            <Field
              label="Manager"
              value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'}
            />
            <Field label="Account status" value={employee.user?.status ?? 'No account yet'} />
          </dl>
        )}

        {tab === 'contact' && (
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field label="Personal email" value={employee.contact?.personalEmail ?? '—'} />
            <Field label="Alternate phone" value={employee.contact?.altPhone ?? '—'} />
            <Field
              label="Address"
              value={
                [
                  employee.contact?.addressLine1,
                  employee.contact?.addressLine2,
                  employee.contact?.city,
                  employee.contact?.state,
                  employee.contact?.country,
                  employee.contact?.postalCode,
                ]
                  .filter(Boolean)
                  .join(', ') || '—'
              }
            />
          </dl>
        )}

        {tab === 'emergency' && (
          <div className="flex flex-col gap-3">
            {employee.emergencyContacts.length === 0 && (
              <p className="text-sm text-slate-400">No emergency contacts on file.</p>
            )}
            {employee.emergencyContacts.map((contact, i) => (
              <div key={contact.id ?? i} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-900">{contact.name}</p>
                <p className="text-sm text-slate-500">{contact.relationship}</p>
                <p className="mt-1 text-sm text-slate-600">{contact.phone}</p>
                {contact.email && <p className="text-sm text-slate-600">{contact.email}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === 'documents' && <EmployeeDocumentsPanel employeeId={employee.id} />}
      </div>

      <EmployeeFormModal open={showEdit} onClose={() => setShowEdit(false)} employee={employee} />
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="size-3.5" />} {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-800">{value}</dd>
    </div>
  );
}
