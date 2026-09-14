import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { settingsApi } from '@/lib/settings-api';
import { getApiErrorMessage } from '@/lib/api-client';

export function MfaEnrollModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  // Deliberately NOT refetched for the lifetime of an open modal: once a
  // secret is issued, generating a new one (setupMfa overwrites it
  // server-side) would desync it from whatever the user just scanned into
  // their authenticator app. `enabled` stops querying the instant
  // verification succeeds (backupCodes is set), and staleTime/refetch
  // flags are disabled as defense in depth so nothing — a window focus
  // event, a background revalidation — can silently re-trigger it while
  // the QR step is still showing either.
  const { data: setup, isLoading: isSettingUp } = useQuery({
    queryKey: ['settings', 'mfa-setup', open],
    queryFn: settingsApi.setupMfa,
    enabled: open && !backupCodes,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const verifyMutation = useMutation({
    mutationFn: () => settingsApi.verifyMfaSetup(code.trim()),
    onSuccess: (result) => {
      setBackupCodes(result.backupCodes);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'That code is incorrect or has expired.')),
  });

  function handleClose() {
    setCode('');
    setError(null);
    setBackupCodes(null);
    setCopied(false);
    onClose();
  }

  function copyBackupCodes() {
    if (!backupCodes) return;
    navigator.clipboard?.writeText(backupCodes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={backupCodes ? 'Save your backup codes' : 'Enable two-factor authentication'}
      description={
        backupCodes
          ? 'Store these somewhere safe — each code can be used once if you lose access to your authenticator app.'
          : 'Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code it shows.'
      }
      size="sm"
      footer={
        backupCodes ? (
          <Button onClick={handleClose}>
            <CheckCircle2 className="size-4" />
            I've saved these — done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={verifyMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => verifyMutation.mutate()}
              isLoading={verifyMutation.isPending}
              disabled={code.trim().length !== 6}
            >
              Verify and enable
            </Button>
          </>
        )
      }
    >
      {backupCodes ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-4 font-mono text-sm text-slate-800">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <button
            type="button"
            onClick={copyBackupCodes}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Copy className="size-3.5" />
            {copied ? 'Copied!' : 'Copy all codes'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {isSettingUp && <p className="py-8 text-sm text-slate-400">Generating your secret…</p>}
          {setup && (
            <>
              <img
                src={setup.qrCodeDataUrl}
                alt="Scan this QR code with your authenticator app"
                className="size-44 rounded-lg border border-slate-200 p-2"
              />
              <div className="w-full rounded-lg bg-slate-50 px-3 py-2 text-center">
                <p className="text-xs text-slate-500">Can't scan? Enter this key manually:</p>
                <p className="mt-1 break-all font-mono text-xs font-medium text-slate-800">{setup.secret}</p>
              </div>
              <div className="w-full">
                <Input
                  label="6-digit code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
              {error && (
                <div className="w-full rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{error}</div>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

export function MfaBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={
        enabled
          ? 'flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700'
          : 'flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500'
      }
    >
      <ShieldCheck className="size-3.5" />
      {enabled ? 'Enabled' : 'Not enabled'}
    </span>
  );
}
