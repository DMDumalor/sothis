import type { RoleCode } from './auth';
import type { NotificationCategory } from './notifications';

export type NotificationChannel = 'IN_APP' | 'EMAIL';

export interface NotificationPreferenceEntry {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface SettingsProfile {
  id: string;
  email: string;
  mfaEnabled: boolean;
  passwordChangedAt: string | null;
  memberSince: string;
  organization: { name: string; code: string; passwordMinLength: number };
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    department: { name: string } | null;
    position: { title: string } | null;
  } | null;
  roles: Array<{ code: RoleCode; name: string }>;
  notificationPreferences: NotificationPreferenceEntry[];
}

export interface SettingsSession {
  id: string;
  createdByIp: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface MfaVerifyResponse {
  success: true;
  backupCodes: string[];
}
