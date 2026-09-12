import clsx from 'clsx';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="border-b border-slate-200">
      <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={clsx(
                'flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
              {typeof tab.count === 'number' && (
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    isActive ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
