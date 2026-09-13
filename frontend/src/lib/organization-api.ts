import { apiClient } from './api-client';
import type { OrganizationProfile, UpdateOrganizationInput } from '@/types/organization';

export const organizationApi = {
  get: () => apiClient.get<OrganizationProfile>('/organization').then((r) => r.data),

  update: (payload: UpdateOrganizationInput) =>
    apiClient.patch<OrganizationProfile>('/organization', payload).then((r) => r.data),
};
