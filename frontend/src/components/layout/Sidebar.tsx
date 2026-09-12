import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Building2, X } from 'lucide-react';
import { getNavSections } from '@/lib/nav-config';
import type { RoleCode } from '@/types/auth';

interface SidebarProps {
  primaryRole: RoleCode;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ primaryRole, isOpen, onClose }: SidebarProps) {
  const sections = getNavSections(primaryRole);

  const content = (
    <div className="flex h-full w-64 flex-col bg-brand-navy text-slate-200">
      <div className="flex items-center justify-between gap-3 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/10">
            <Building2 className="size-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-white">SOTHIS 1618</p>
            <p className="text-[11px] uppercase tracking-wider text-slate-400">HR ERP</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section, idx) => (
          <div key={idx} className="mb-4">
            {section.label && (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {section.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-white/10 text-white'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden shrink-0 lg:block">{content}</aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="absolute inset-y-0 left-0">{content}</div>
        </div>
      )}
    </>
  );
}
