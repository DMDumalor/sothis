import type { PaginatedResult } from './org';

export type InsightCategory = 'PAYROLL' | 'ATTENDANCE' | 'LEAVE' | 'SECURITY' | 'WORKFORCE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InsightStatus = 'OPEN' | 'UNDER_REVIEW' | 'REVIEWED' | 'DISMISSED';

export interface SmartInsight {
  id: string;
  category: InsightCategory;
  title: string;
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
  affectedArea: string;
  recommendedAction: string;
  status: InsightStatus;
  inputs: Record<string, unknown>;
  ruleCode: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewer: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null;
}

export interface InsightsSummary {
  openCount: number;
  underReviewCount: number;
  byCategory: Record<string, number>;
  byRiskLevel: Record<string, number>;
}

export type InsightsPage = PaginatedResult<SmartInsight>;
