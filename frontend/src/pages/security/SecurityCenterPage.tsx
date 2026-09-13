import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck, Activity, FileClock } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { KpiCard } from '@/components/ui/KpiCard';
import { Table, type Column } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { securityApi } from '@/lib/security-api';
import { SECURITY_SEVERITY_LABELS, SECURITY_SEVERITY_TONE } from '@/lib/org-labels';
import type { AuditLogEntry, SecurityEventEntry } from '@/types/security';

function AuditLogTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['security', 'audit-logs', page],
    queryFn: () => securityApi.listAuditLogs({ page, pageSize: 20 }),
  });

  const columns: Column<AuditLogEntry>[] = [
    { key: 'action', header: 'Action', render: (row) => <span className="font-medium text-slate-800">{row.action}</span> },
    { key: 'resource', header: 'Resource', render: (row) => `${row.resourceType}${row.resourceId ? ` · ${row.resourceId.slice(0, 8)}` : ''}` },
    {
      key: 'actor',
      header: 'Actor',
      render: (row) => (row.actor ? row.actor.email : 'System'),
    },
    { key: 'ip', header: 'IP', render: (row) => row.ipAddress ?? '—' },
    { key: 'when', header: 'When', render: (row) => new Date(row.createdAt).toLocaleString() },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <Table
        columns={columns}
        data={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No audit log entries yet."
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
  );
}

function SecurityEventsTab() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['security', 'events', page],
    queryFn: () => securityApi.listSecurityEvents({ page, pageSize: 20 }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => securityApi.resolveEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['security', 'summary'] });
    },
  });

  const columns: Column<SecurityEventEntry>[] = [
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => (
        <StatusBadge tone={SECURITY_SEVERITY_TONE[row.severity]}>{SECURITY_SEVERITY_LABELS[row.severity]}</StatusBadge>
      ),
    },
    { key: 'type', header: 'Type', render: (row) => row.type.replaceAll('_', ' ') },
    { key: 'description', header: 'Description', render: (row) => row.description },
    { key: 'user', header: 'User', render: (row) => row.user?.email ?? '—' },
    { key: 'when', header: 'When', render: (row) => new Date(row.createdAt).toLocaleString() },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.resolved ? (
          <StatusBadge tone="success">Resolved</StatusBadge>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            isLoading={resolveMutation.isPending && resolveMutation.variables === row.id}
            onClick={() => resolveMutation.mutate(row.id)}
          >
            Mark resolved
          </Button>
        ),
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <Table
        columns={columns}
        data={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No security events recorded."
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
  );
}

export function SecurityCenterPage() {
  const [tab, setTab] = useState<'events' | 'audit'>('events');
  const { data: summary } = useQuery({ queryKey: ['security', 'summary'], queryFn: securityApi.summary });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Security & Audit Center</h1>
        <p className="mt-1 text-sm text-slate-500">Monitor security events and review the tenant's audit trail.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard icon={ShieldAlert} label="Unresolved events" value={summary?.unresolvedCount ?? '—'} tone="warning" />
        <KpiCard icon={ShieldAlert} label="Critical (unresolved)" value={summary?.criticalUnresolvedCount ?? '—'} tone="error" />
        <KpiCard icon={Activity} label="Events (24h)" value={summary?.eventsLast24h ?? '—'} tone="info" />
        <KpiCard icon={FileClock} label="Audit actions (24h)" value={summary?.auditActionsLast24h ?? '—'} tone="neutral" />
      </div>

      <Tabs
        tabs={[
          { key: 'events', label: 'Security Events', count: summary?.unresolvedCount },
          { key: 'audit', label: 'Audit Log' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {tab === 'events' ? <SecurityEventsTab /> : <AuditLogTab />}

      {summary?.criticalUnresolvedCount === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <ShieldCheck className="size-4 shrink-0" />
          No critical unresolved security events right now.
        </div>
      )}
    </div>
  );
}
