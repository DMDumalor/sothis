import clsx from 'clsx';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}

/** Small on/off switch used for permission grants and other binary settings. */
export function Toggle({ checked, onChange, disabled, label, size = 'md' }: ToggleProps) {
  const trackSize = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knobSize = size === 'sm' ? 'size-3.5' : 'size-4.5';
  const knobTranslate = size === 'sm' ? (checked ? 'translate-x-4' : 'translate-x-0.5') : checked ? 'translate-x-5' : 'translate-x-0.5';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={clsx(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary',
        trackSize,
        checked ? 'bg-brand-primary' : 'bg-slate-300',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={clsx(
          'inline-block rounded-full bg-white shadow transition-transform',
          knobSize,
          knobTranslate,
        )}
      />
    </button>
  );
}
