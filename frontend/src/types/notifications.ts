export type NotificationCategory =
  | 'DOCUMENT_EXPIRY'
  | 'LEAVE'
  | 'ATTENDANCE'
  | 'OVERTIME'
  | 'PAYROLL'
  | 'SECURITY'
  | 'WORKFORCE'
  | 'SYSTEM';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  items: AppNotification[];
  unreadCount: number;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
