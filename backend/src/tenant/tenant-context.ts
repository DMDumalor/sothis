import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

/**
 * Request-scoped tenant context. Services depend on this instead of reading
 * the raw Express request, so business logic never has a chance to pick up
 * a tenantId from anywhere except the authenticated JWT principal that
 * JwtStrategy attached to the request.
 *
 * DO NOT add a way to construct this from a route param/body/query value.
 * That is precisely the "trust the frontend tenant id" mistake spec
 * section 7 calls out as forbidden.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  constructor(@Inject(REQUEST) private readonly request: AuthenticatedRequest) {}

  get tenantId(): string {
    if (!this.request.user?.tenantId) {
      throw new UnauthorizedException('No tenant context on request');
    }
    return this.request.user.tenantId;
  }

  get userId(): string {
    if (!this.request.user?.userId) {
      throw new UnauthorizedException('No authenticated user on request');
    }
    return this.request.user.userId;
  }

  get employeeId(): string | null {
    return this.request.user?.employeeId ?? null;
  }

  get roles() {
    return this.request.user?.roles ?? [];
  }
}
