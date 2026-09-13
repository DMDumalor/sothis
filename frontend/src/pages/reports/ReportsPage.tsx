import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Users, CalendarDays, Clock, Wallet } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { KpiCard } from '@/components/ui/KpiCard';
import { useAuthStore } from '@/stores/auth-store';
import { reportsApi } from '@/lib/reports-api';

const CHART_COLORS = ['#2563eb', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="h-72 w-full">{children}</div>
    </div>
  );
}

function WorkforceTab() {
  const { data, isLoading } = useQuery({ queryKey: ['reports', 'workforce'], queryFn: reportsApi.workforce });
  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading…</p>;

  const statusData = Object.entries(data.byEmploymentStatus).map(([name, value]) => ({ name, value }));
  const deptData = data.byDepartment.map((d) => ({ name: d.departmentName, value: d.headcount }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Users} label="Total headcount" value={data.totalHeadcount} tone="info" />
        <KpiCard
          icon={Users}
          label="Active"
          value={data.byEmploymentStatus.ACTIVE ?? 0}
          tone="success"
        />
        <KpiCard
          icon={Users}
          label="On leave / other"
          value={data.totalHeadcount - (data.byEmploymentStatus.ACTIVE ?? 0)}
          tone="warning"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Headcount by department">
          <ResponsiveContainer>
            <BarChart data={deptData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Employment status breakdown">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {statusData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function LeaveTab() {
  const { data, isLoading } = useQuery({ queryKey: ['reports', 'leave'], queryFn: () => reportsApi.leave() });
  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading…</p>;

  const typeData = data.byLeaveType.map((t) => ({ name: t.leaveTypeName, value: t.totalDays ?? 0 }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={CalendarDays} label="Approved requests" value={data.approvedRequests} tone="success" />
        <KpiCard icon={CalendarDays} label="Total approved days" value={data.totalApprovedDays ?? 0} tone="info" />
        <KpiCard icon={CalendarDays} label="Pending" value={data.byStatus.PENDING ?? 0} tone="warning" />
      </div>
      <ChartCard title="Approved leave days by type">
        <ResponsiveContainer>
          <BarChart data={typeData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function AttendanceTab() {
  const { data, isLoading } = useQuery({ queryKey: ['reports', 'attendance'], queryFn: () => reportsApi.attendance() });
  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading…</p>;

  const statusData = Object.entries(data.byStatus).map(([name, value]) => ({ name, value }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={Clock}
          label="Punctuality rate"
          value={data.punctualityRate !== null ? `${Math.round(data.punctualityRate * 100)}%` : '—'}
          tone="success"
        />
        <KpiCard
          icon={Clock}
          label="Approved overtime hours"
          value={data.approvedOvertimeHours ?? 0}
          tone="info"
        />
        <KpiCard
          icon={Clock}
          label="Avg. worked minutes/day"
          value={data.averageWorkedMinutes ? Math.round(data.averageWorkedMinutes) : '—'}
          tone="neutral"
        />
      </div>
      <ChartCard title="Attendance status breakdown">
        <ResponsiveContainer>
          <BarChart data={statusData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function PayrollTab() {
  const { data, isLoading } = useQuery({ queryKey: ['reports', 'payroll'], queryFn: () => reportsApi.payroll() });
  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading…</p>;

  const trendData = data.trend.map((t) => ({ name: t.periodName, gross: t.totalGross, net: t.totalNet }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Wallet} label="Total gross paid" value={data.overall.totalGross.toLocaleString()} tone="info" />
        <KpiCard icon={Wallet} label="Total net paid" value={data.overall.totalNet.toLocaleString()} tone="success" />
        <KpiCard icon={Wallet} label="Total deductions" value={data.overall.totalDeductions.toLocaleString()} tone="warning" />
      </div>
      <ChartCard title="Payroll cost trend by period">
        <ResponsiveContainer>
          <LineChart data={trendData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="gross" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export function ReportsPage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canSeePayroll = roles.includes('FINANCE') || roles.includes('DG');
  const [tab, setTab] = useState<'workforce' | 'leave' | 'attendance' | 'payroll'>('workforce');

  const tabs = [
    { key: 'workforce', label: 'Workforce' },
    { key: 'leave', label: 'Leave' },
    { key: 'attendance', label: 'Attendance' },
    ...(canSeePayroll ? [{ key: 'payroll', label: 'Payroll' }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Workforce, leave, attendance and payroll analytics.</p>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as typeof tab)} />

      {tab === 'workforce' && <WorkforceTab />}
      {tab === 'leave' && <LeaveTab />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'payroll' && canSeePayroll && <PayrollTab />}
    </div>
  );
}
