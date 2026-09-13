import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import clsx from 'clsx';
import { notificationsApi } from '@/lib/notifications-api';
import type { AppNotification } from '@/types/notifications';

const SEVERITY_DOT: Record<AppNotification['severity'], string> = {
  INFO: 'bg-blue-500',
  WARNING: 'bg-amber-500',
  CRITICAL: 'bg-red-500',
};

/**
 * Bell + inbox dropdown wired to the real M5 notifications API. Polls the
 * unread count periodically so a new insight/leave decision/security alert
 * surfaces without a manual refresh, without needing a websocket for a
 * first pass.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30000,
  });

  const { data } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list({ pageSize: 8 }),
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  function handleClick(n: AppNotification) {
    if (!n.isRead) markReadMutation.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  const count = unread?.unreadCount ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-800">Notifications</span>
              {count > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                >
                  <CheckCheck className="size-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {(data?.items.length ?? 0) === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">You're all caught up.</p>
              )}
              {data?.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={clsx(
                    'flex w-full items-start gap-2.5 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50',
                    !n.isRead && 'bg-blue-50/40',
                  )}
                >
                  <span className={clsx('mt-1.5 size-2 shrink-0 rounded-full', SEVERITY_DOT[n.severity])} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800">{n.title}</span>
                    <span className="block truncate text-xs text-slate-500">{n.message}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
