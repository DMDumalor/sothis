export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
export type Gender = 'MALE' | 'FEMALE' | 'UNSPECIFIED';
export type DocumentType = 'IDENTITY' | 'EMPLOYMENT_CONTRACT' | 'CERTIFICATE' | 'OTHER';

export interface DepartmentSummary {
  id: string;
  name: string;
}

export interface PositionSummary {
  id: string;
  title: string;
}

export interface Department {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string | null;
  headEmployeeId: string | null;
  parentDepartmentId: string | null;
  createdAt: string;
  updatedAt: string;
  headEmployee?: { id: string; firstName: string; lastName: string } | null;
  parentDepartment?: { id: string; name: string } | null;
  _count?: { employees: number; positions: number };
}

export interface Position {
  id: string;
  tenantId: string;
  title: string;
  code: string;
  departmentId: string | null;
  level: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  department?: DepartmentSummary | null;
}

export interface EmployeeListItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  startDate: string;
  department: DepartmentSummary | null;
  position: PositionSummary | null;
}

export interface EmployeeContact {
  personalEmail?: string | null;
  altPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
}

export interface EmergencyContact {
  id?: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
  address?: string | null;
}

export interface EmployeeDetail extends EmployeeListItem {
  dateOfBirth: string | null;
  gender: Gender;
  managerId: string | null;
  endDate: string | null;
  manager?: { id: string; firstName: string; lastName: string } | null;
  contact: EmployeeContact | null;
  emergencyContacts: EmergencyContact[];
  directReports: { id: string; firstName: string; lastName: string }[];
  user: { id: string; status: string; lastLoginAt: string | null } | null;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface EmployeeQuery {
  search?: string;
  departmentId?: string;
  positionId?: string;
  status?: EmploymentStatus;
  page?: number;
  pageSize?: number;
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: Gender;
  departmentId?: string;
  positionId?: string;
  managerId?: string;
  employmentType: EmploymentType;
  startDate: string;
  contact?: EmployeeContact;
  emergencyContacts?: EmergencyContact[];
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  employmentStatus?: EmploymentStatus;
  endDate?: string;
};

export interface EmployeeDocumentSummary {
  id: string;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  expiryDate: string | null;
  uploadedById: string;
  uploadedAt: string;
}
