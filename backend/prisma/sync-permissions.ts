/**
 * Idempotent permission/role-permission sync — upserts PERMISSION_CATALOG
 * and ROLE_PERMISSION_MATRIX for every EXISTING tenant, without touching
 * any other data. Use this when the permission catalog or role matrix
 * changes after the initial seed (e.g. a new milestone adds a permission)
 * instead of re-running seed.ts, which uses non-idempotent createMany/
 * create calls for demo leave/attendance/overtime/payroll/audit data and
 * would duplicate it on a second run.
 *
 * Run with: npx ts-node -r tsconfig-paths/register prisma/sync-permissions.ts
 */
import 'dotenv/config';
import { PrismaClient, RoleCode } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PERMISSION_CATALOG } from '../src/rbac/permissions.constants';
import { ROLE_PERMISSION_MATRIX } from '../src/rbac/role-permission-matrix';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  for (const perm of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { module: perm.module, description: perm.description },
      create: perm,
    });
  }
  console.log(`Synced ${PERMISSION_CATALOG.length} permissions`);

  const tenants = await prisma.tenant.findMany({ select: { id: true, code: true } });

  for (const tenant of tenants) {
    const roles = await prisma.role.findMany({ where: { tenantId: tenant.id } });
    for (const role of roles) {
      const code = role.code as RoleCode;
      const grants = ROLE_PERMISSION_MATRIX[code];
      if (!grants) continue;
      for (const grant of grants) {
        const permission = await prisma.permission.findUniqueOrThrow({
          where: { code: grant.permission },
        });
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: { scope: grant.scope },
          create: { roleId: role.id, permissionId: permission.id, scope: grant.scope },
        });
      }
    }
    console.log(`Synced role permissions for tenant ${tenant.code}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
