import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Central Prisma client for the whole application. Uses the `pg` driver
 * adapter (Prisma's "driverAdapters" preview feature) rather than Prisma's
 * bundled native query engine binary, which keeps the runtime dependency
 * surface to plain npm packages.
 *
 * IMPORTANT: this service does not, by itself, enforce tenant isolation.
 * Tenant scoping is applied by callers via the repository/service layer
 * using TenantContext — see src/tenant/tenant-context.ts. Never build a
 * query here (or anywhere) using a tenantId taken directly from client
 * input (route params, body, query string).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('databaseUrl');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL via Prisma');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
