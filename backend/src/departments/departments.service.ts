import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * `restrictToDepartmentId` is set by the controller when the caller's
   * granted scope is DEPARTMENT (a Department Head) rather than TENANT —
   * this is the row-level narrowing PermissionsGuard's scope resolution
   * exists to drive. Never omit it when the scope isn't TENANT.
   */
  async list(tenantId: string, restrictToDepartmentId?: string) {
    const departments = await this.prisma.department.findMany({
      where: {
        tenantId,
        ...(restrictToDepartmentId ? { id: restrictToDepartmentId } : {}),
      },
      include: {
        headEmployee: { select: { id: true, firstName: true, lastName: true } },
        parentDepartment: { select: { id: true, name: true } },
        _count: { select: { employees: true, positions: true } },
      },
      orderBy: { name: 'asc' },
    });
    return departments;
  }

  async findOne(tenantId: string, id: string, restrictToDepartmentId?: string) {
    if (restrictToDepartmentId && restrictToDepartmentId !== id) {
      throw new NotFoundException('Department not found');
    }
    const department = await this.prisma.department.findFirst({
      where: { id, tenantId },
      include: {
        headEmployee: { select: { id: true, firstName: true, lastName: true } },
        parentDepartment: { select: { id: true, name: true } },
        childDepartments: { select: { id: true, name: true } },
        positions: { select: { id: true, title: true } },
        _count: { select: { employees: true } },
      },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }

  async listEmployees(tenantId: string, departmentId: string, restrictToDepartmentId?: string) {
    if (restrictToDepartmentId && restrictToDepartmentId !== departmentId) {
      throw new NotFoundException('Department not found');
    }
    await this.findOne(tenantId, departmentId);
    return this.prisma.employee.findMany({
      where: { tenantId, departmentId },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        employmentStatus: true,
        position: { select: { id: true, title: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async create(params: {
    tenantId: string;
    dto: CreateDepartmentDto;
    actorUserId: string;
  }) {
    try {
      const department = await this.prisma.department.create({
        data: { tenantId: params.tenantId, ...params.dto },
      });
      await this.audit.record({
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: 'department.created',
        resourceType: 'Department',
        resourceId: department.id,
        metadata: { name: department.name, code: department.code },
      });
      return department;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A department with this code already exists.');
      }
      throw error;
    }
  }

  async update(params: {
    tenantId: string;
    id: string;
    dto: UpdateDepartmentDto;
    actorUserId: string;
  }) {
    const existing = await this.findOne(params.tenantId, params.id);
    try {
      const department = await this.prisma.department.update({
        where: { id: existing.id },
        data: params.dto,
      });
      await this.audit.record({
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: 'department.updated',
        resourceType: 'Department',
        resourceId: department.id,
        metadata: { changes: JSON.parse(JSON.stringify(params.dto)) },
      });
      return department;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A department with this code already exists.');
      }
      throw error;
    }
  }
}
