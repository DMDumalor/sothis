import { apiClient } from './api-client';
import type { DocumentType, EmployeeDocumentSummary } from '@/types/org';

export const employeeDocumentsApi = {
  list: (employeeId: string) =>
    apiClient
      .get<EmployeeDocumentSummary[]>(`/employees/${employeeId}/documents`)
      .then((r) => r.data),

  upload: (employeeId: string, file: File, type: DocumentType, expiryDate?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    if (expiryDate) form.append('expiryDate', expiryDate);
    return apiClient
      .post<EmployeeDocumentSummary>(`/employees/${employeeId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  remove: (employeeId: string, documentId: string) =>
    apiClient.delete(`/employees/${employeeId}/documents/${documentId}`),
};

/**
 * Documents are never served from a plain/public URL (spec section 46), so
 * a normal <a href> download won't carry the bearer token. This fetches
 * the file through the authenticated API client and hands the browser a
 * short-lived object URL to save instead.
 */
export async function downloadEmployeeDocument(
  employeeId: string,
  documentId: string,
  fileName: string,
) {
  const response = await apiClient.get(`/employees/${employeeId}/documents/${documentId}/download`, {
    responseType: 'blob',
  });
  const blobUrl = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
