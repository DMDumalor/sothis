import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { authApi } from '@/lib/auth-api';

/**
 * "/profile" has no id in the URL — it resolves the current user's own
 * employee record and redirects to the normal profile route, which then
 * relies on the backend's OWN-scope restriction (not this redirect) to
 * ensure the caller can only ever see their own record.
 */
export function MyProfileRedirect() {
  const { data: me, isLoading } = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (!me?.employee) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        No employee record is linked to your account yet.
      </div>
    );
  }

  return <Navigate to={`/employees/${me.employee.id}`} replace />;
}
