import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PermissionScope } from '@prisma/client';

/**
 * Reads the scope PermissionsGuard resolved for the current request (the
 * broadest scope the caller's role grants for the required permission).
 * Controllers use this to decide whether to pass a DEPARTMENT/OWN
 * restriction down into the service layer — see departments.service.ts's
 * `restrictToDepartmentId` pattern.
 */
export const GrantedScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PermissionScope | undefined => {
    const request = ctx.switchToHttp().getRequest<{ grantedScope?: PermissionScope }>();
    return request.grantedScope;
  },
);
