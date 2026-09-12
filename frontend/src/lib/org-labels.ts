import type { DocumentType, EmploymentStatus, EmploymentType, Gender } from '@/types/org';

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
};

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  ACTIVE: 'Active',
  ON_LEAVE: 'On leave',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
};

export const EMPLOYMENT_STATUS_TONE: Record<EmploymentStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  SUSPENDED: 'error',
  TERMINATED: 'neutral',
};

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  UNSPECIFIED: 'Unspecified',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  IDENTITY: 'Identity document',
  EMPLOYMENT_CONTRACT: 'Employment contract',
  CERTIFICATE: 'Certificate',
  OTHER: 'Other',
};
