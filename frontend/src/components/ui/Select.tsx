import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, id, className, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={!!error}
            className={clsx(
              'h-11 w-full appearance-none rounded-lg border bg-white px-3.5 pr-9 text-sm text-slate-900',
              'focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary',
              error ? 'border-brand-error' : 'border-slate-300',
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
        </div>
        {error && <p className="text-sm text-brand-error">{error}</p>}
        {!error && hint && <p className="text-sm text-slate-500">{hint}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';
