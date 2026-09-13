import { apiClient } from './api-client';
import type { InsightsPage, InsightsSummary } from '@/types/intelligence';

export const intelligenceApi = {
  summary: () => apiClient.get<InsightsSummary>('/intelligence/summary').then((r) => r.data),

  list: (params: { category?: string; status?: string; riskLevel?: string; page?: number; pageSize?: number }) =>
    apiClient.get<InsightsPage>('/intelligence/insights', { params }).then((r) => r.data),

  review: (id: string, status: 'UNDER_REVIEW' | 'REVIEWED' | 'DISMISSED', reviewNote?: string) =>
    apiClient.patch(`/intelligence/insights/${id}/review`, { status, reviewNote }).then((r) => r.data),

  runDetectors: () => apiClient.post<{ raisedCount: number }>('/intelligence/evaluate').then((r) => r.data),
};
