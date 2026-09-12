import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Table, type Column } from '@/components/ui/Table';
import { useAuthStore } from '@/stores/auth-store';
import { positionsApi } from '@/lib/positions-api';
import { canManageOrgStructure } from '@/lib/ui-permissions';
import type { Position } from '@/types/org';
import { PositionFormModal } from './PositionFormModal';

export function PositionsPage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage = canManageOrgStructure(roles);

  const { data: positions, isLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.list(),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);

  const columns: Column<Position>[] = [
    { key: 'title', header: 'Title', render: (row) => <span className="font-medium text-slate-900">{row.title}</span> },
    { key: 'code', header: 'Code', render: (row) => row.code },
    { key: 'department', header: 'Department', render: (row) => row.department?.name ?? '—' },
    { key: 'level', header: 'Level', render: (row) => row.level ?? '—' },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (row: Position) => (
              <button
                onClick={() => setEditing(row)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label={`Edit ${row.title}`}
              >
                <Pencil className="size-4" />
              </button>
            ),
          } satisfies Column<Position>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Positions</h1>
          <p className="mt-1 text-sm text-slate-500">
            {positions ? `${positions.length} position${positions.length === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> Add position
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table columns={columns} data={positions ?? []} rowKey={(row) => row.id} isLoading={isLoading} />
      </div>

      <PositionFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      <PositionFormModal open={!!editing} onClose={() => setEditing(null)} position={editing} />
    </div>
  );
}
