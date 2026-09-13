import type { RoleCode } from '@/types/auth';
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  CalendarDays,
  Clock,
  Wallet,
  BarChart3,
  Sparkles,
  ShieldAlert,
  Settings,
  Receipt,
  FileText,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

/**
 * Role-aware sidebar navigation (spec section 32). This governs UX only —
 * it is not a security boundary. Every route it links to is independently
 * protected server-side by JwtAuthGuard + PermissionsGuard.
 */
export function getNavSections(primaryRole: RoleCode): NavSection[] {
  const dashboard: NavSection = {
    items: [
      {
        label: primaryRole === 'DG' ? 'Executive Dashboard' : 'Dashboard',
        to: '/',
        icon: LayoutDashboard,
      },
    ],
  };

  switch (primaryRole) {
    case 'HR':
      return [
        dashboard,
        {
          label: 'People',
          items: [
            { label: 'Employees', to: '/employees', icon: Users },
            { label: 'Departments', to: '/departments', icon: Building2 },
            { label: 'Positions', to: '/positions', icon: Briefcase },
          ],
        },
        {
          label: 'Time',
          items: [
            { label: 'Leave', to: '/leave', icon: CalendarDays },
            { label: 'Attendance', to: '/attendance', icon: Clock },
            { label: 'Overtime', to: '/overtime', icon: Clock },
          ],
        },
        { label: 'Insights', items: [
          { label: 'Reports', to: '/reports', icon: BarChart3 },
          { label: 'Smart Insights', to: '/intelligence', icon: Sparkles },
        ] },
        { label: 'System', items: [
          { label: 'Settings', to: '/settings', icon: Settings },
        ] },
      ];
    case 'DEPARTMENT_HEAD':
      return [
        dashboard,
        {
          items: [
            { label: 'My Team', to: '/team', icon: Users },
            { label: 'Leave Approvals', to: '/leave/approvals', icon: CalendarDays },
            { label: 'Attendance', to: '/attendance', icon: Clock },
            { label: 'Overtime', to: '/overtime', icon: Clock },
            { label: 'Reports', to: '/reports', icon: BarChart3 },
            { label: 'Smart Insights', to: '/intelligence', icon: Sparkles },
          ],
        },
        { label: 'System', items: [{ label: 'Settings', to: '/settings', icon: Settings }] },
      ];
    case 'FINANCE':
      return [
        dashboard,
        {
          label: 'Finance',
          items: [
            { label: 'Payroll', to: '/payroll', icon: Wallet },
            { label: 'Payments', to: '/payments', icon: Receipt },
            { label: 'Payslips', to: '/payslips', icon: FileText },
            { label: 'Financial Reports', to: '/reports', icon: BarChart3 },
          ],
        },
        {
          label: 'People',
          items: [{ label: 'Employees', to: '/employees', icon: Users }],
        },
        { label: 'Insights', items: [{ label: 'Smart Insights', to: '/intelligence', icon: Sparkles }] },
        { label: 'System', items: [
          { label: 'Settings', to: '/settings', icon: Settings },
        ] },
      ];
    case 'DG':
      return [
        dashboard,
        {
          label: 'Organization',
          items: [
            { label: 'Workforce', to: '/workforce', icon: Users },
            { label: 'Departments', to: '/departments', icon: Building2 },
          ],
        },
        { label: 'Finance', items: [{ label: 'Payroll', to: '/payroll', icon: Wallet }] },
        {
          label: 'Analytics',
          items: [
            { label: 'Reports', to: '/reports', icon: BarChart3 },
            { label: 'Intelligence', to: '/intelligence', icon: Sparkles },
          ],
        },
        { label: 'System', items: [
          { label: 'Security', to: '/security', icon: ShieldAlert },
          { label: 'Settings', to: '/settings', icon: Settings },
        ] },
      ];
    case 'ADMIN':
      return [
        dashboard,
        {
          label: 'Platform',
          items: [
            { label: 'Users', to: '/admin/users', icon: Users },
            { label: 'Roles & Permissions', to: '/admin/roles', icon: ShieldAlert },
            { label: 'Organization Settings', to: '/admin/organization', icon: Building2 },
          ],
        },
        { label: 'System', items: [
          { label: 'Security', to: '/security', icon: ShieldAlert },
          { label: 'Settings', to: '/settings', icon: Settings },
        ] },
      ];
    case 'EMPLOYEE':
    default:
      return [
        dashboard,
        {
          items: [
            { label: 'My Profile', to: '/profile', icon: Users },
            { label: 'Leave', to: '/leave', icon: CalendarDays },
            { label: 'Attendance', to: '/attendance', icon: Clock },
            { label: 'Payslips', to: '/payslips', icon: FileText },
          ],
        },
        { label: 'System', items: [{ label: 'Settings', to: '/settings', icon: Settings }] },
      ];
  }
}

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Administrator',
  HR: 'HR Manager',
  DEPARTMENT_HEAD: 'Department Head',
  FINANCE: 'Finance Manager',
  DG: 'Director-General',
  EMPLOYEE: 'Employee',
};
