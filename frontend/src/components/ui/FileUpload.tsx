import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import clsx from 'clsx';

interface FileUploadProps {
  onFileSelected: (file: File | null) => void;
  accept?: string;
  maxSizeBytes?: number;
  error?: string;
}

export function FileUpload({ onFileSelected, accept, maxSizeBytes, error }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selected: File | null) => {
    setLocalError(null);
    if (selected && maxSizeBytes && selected.size > maxSizeBytes) {
      setLocalError(`File exceeds the ${Math.floor(maxSizeBytes / (1024 * 1024))}MB limit.`);
      setFile(null);
      onFileSelected(null);
      return;
    }
    setFile(selected);
    onFileSelected(selected);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  };

  if (file) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-5 shrink-0 text-brand-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-700">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleFile(null)}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          aria-label="Remove file"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={clsx(
          'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
          isDragging ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-300 hover:border-slate-400',
        )}
      >
        <UploadCloud className="size-6 text-slate-400" />
        <p className="text-sm text-slate-600">
          <span className="font-medium text-brand-primary">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-slate-400">PDF, JPEG, PNG, DOC, DOCX up to 10MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {(localError || error) && <p className="mt-1.5 text-sm text-brand-error">{localError ?? error}</p>}
    </div>
  );
}
