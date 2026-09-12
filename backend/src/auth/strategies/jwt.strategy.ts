import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RoleCode, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedPrincipal } from '../../common/interfaces/authenticated-request.interface';

export interface AccessTokenPayload {
  sub: string; // userId
  tenantId: string;
  email: string;
  roles: RoleCode[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
    });
  }

  /**
   * Re-checks the user's live status on every request rather than trusting
   * the JWT alone, so a disabled/locked account loses access immediately
   * instead of waiting out the access token's TTL.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedPrincipal> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        tenantId: true,
        email: true,
        status: true,
        employee: { select: { id: true } },
      },
    });

    if (!user || user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Invalid session');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles: payload.roles,
      employeeId: user.employee?.id ?? null,
    };
  }
}
