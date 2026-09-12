import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { FileUpload } from '@/components/ui/FileUpload';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/stores/auth-store';
import { canDeleteDocuments, canUploadDocuments } from '@/lib/ui-permissions';
import { downloadEmployeeDocument, employeeDocumentsApi } from '@/lib/employee-documents-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { DOCUMENT_TYPE_LABELS } from '@/lib/org-labels';
import type { DocumentType, EmployeeDocumentSummary } from '@/types/org';

const MAX_SIZE = 10 * 1024 * 1024;

export function EmployeeDocumentsPanel({ employeeId }: { employeeId: string }) {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canUpload = canUploadDocuments(roles);
  const canDelete = canDeleteDocuments(roles);
  const queryClient = useQueryClient();

  const [showUpload, setShowUpload] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EmployeeDocumentSummary | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: () => employeeDocumentsApi.list(employeeId),
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => employeeDocumentsApi.remove(employeeId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] });
      setPendingDelete(null);
    },
  });

  const handleDownload = async (doc: EmployeeDocumentSummary) => {
    setDownloadError(null);
    try {
      await downloadEmployeeDocument(employeeId, doc.id, doc.fileName);
    } catch (error) {
      setDownloadError(getApiErrorMessage(error, 'Could not download this document.'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {documents ? `${documents.length} document${documents.length === 1 ? '' : 's'}` : 'Loading…'}
        </p>
        {canUpload && (
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="size-4" /> Upload document
          </Button>
        )}
      </div>

      {downloadError && <p className="text-sm text-brand-error">{downloadError}</p>}

      {isLoading && <p className="text-sm text-slate-400">Loading documents…</p>}

      {!isLoading && (documents?.length ?? 0) === 0 && (
        <p className="text-sm text-slate-400">No documents uploaded yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {documents?.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="size-5 shrink-0 text-brand-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{doc.fileName}</p>
                <p className="text-xs text-slate-500">
                  {DOCUMENT_TYPE_LABELS[doc.type]} · {(doc.sizeBytes / 1024).toFixed(0)} KB ·{' '}
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                <Download className="size-4" />
              </Button>
              {canDelete && (
                <Button variant="ghost" size="sm" onClick={() => setPendingDelete(doc)}>
                  <Trash2 className="size-4 text-brand-error" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <UploadDocumentModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        employeeId={employeeId}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete document"
        description={`Are you sure you want to delete "${pendingDelete?.fileName}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        isLoading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function UploadDocumentModal({
  open,
  onClose,
  employeeId,
}: {
  open: boolean;
  onClose: () => void;
  employeeId: string;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<DocumentType>('OTHER');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Select a file first.');
      return employeeDocumentsApi.upload(employeeId, file, type);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] });
      setFile(null);
      setType('OTHER');
      onClose();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload document"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending} disabled={!file}>
            Upload
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p className="text-sm text-brand-error">{error}</p>}
        <Select label="Document type" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <FileUpload
          onFileSelected={setFile}
          maxSizeBytes={MAX_SIZE}
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        />
      </div>
    </Modal>
  );
}
