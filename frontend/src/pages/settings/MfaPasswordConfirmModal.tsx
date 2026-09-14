import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { settingsApi } from '@/lib/settings-api';
import { getApiErrorMessage } from '@/lib/api-client';

interface Props {
  open: boolean;
  mode: 'disable' | 'regenerate' | null;
  onClose: () => void;
}

/** Shared "confirm your password before we do this" flow for the two
 * sensitive MFA actions that don't need the full enroll wizard: disabling
 * two-factor entirely, and regenerating backup codes (which shows the new
 * codes once, exactly like the enroll flow does). */
export function MfaPasswordConfirmModal({ open, mode, onClose }: Props) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'disable'
        ? settingsApi.disableMfa(password)
        : settingsApi.regenerateBackupCodes(password),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      if (mode === 'regenerate' && result && 'backupCodes' in result) {
        setNewBackupCodes(result.backupCodes);
      } else {
        handleClose();
      }
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Incorrect password.')),
  });

  function handleClose() {
    setPassword('');
    setError(null);
    setNewBackupCodes(null);
    setCopied(false);
    onClose();
  }

  function copyBackupCodes() {
    if (!newBackupCodes) return;
    navigator.clipboard?.writeText(newBackupCodes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const title = newBackupCodes
    ? 'Your new backup codes'
    : mode === 'disable'
      ? 'Disable two-factor authentication?'
      : 'Regenerate backup codes?';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      description={
        newBackupCodes
          ? 'Your previous backup codes no longer work. Store these somewhere safe.'
          : mode === 'disable'
            ? 'Your account will only require a password to sign in. Confirm your password to continue.'
            : 'Your existing backup codes will stop working. Confirm your password to generate a fresh set.'
      }
      size="sm"
      footer={
        newBackupCodes ? (
          <Button onClick={handleClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              variant={mode === 'disable' ? 'danger' : 'primary'}
              onClick={() => mutation.mutate()}
              isLoading={mutation.isPending}
              disabled={!password}
            >
              {mode === 'disable' ? 'Disable' : 'Regenerate'}
            </Button>
          </>
        )
      }
    >
      {newBackupCodes ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-4 font-mono text-sm text-slate-800">
            {newBackupCodes.map((c) => (
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
        <div className="flex flex-col gap-3">
          <Input
            label="Current password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          {error && <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-brand-error">{error}</div>}
        </div>
      )}
    </Modal>
  );
}
