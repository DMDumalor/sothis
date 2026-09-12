import { Request } from 'express';
import { RoleCode } from '@prisma/client';

/**
 * Shape of req.user after JwtStrategy validates an access token. This is
 * the ONLY source of tenantId/roles that authorization code may trust —
 * never a route param, query string, or request body field.
 */
export interface AuthenticatedPrincipal {
  userId: string;
  tenantId: string;
  email: string;
  roles: RoleCode[];
  employeeId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}
