import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';

export interface EmployeeScopeRestriction {
  /** Department Head grant: only employees in this department. */
  departmentId?: string;
  /** Employee (self-service) grant: only this one employee record. */
  onlyEmployeeId?: string;
}

const EMPLOYEE_LIST_SELECT = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  employmentType: true,
  employmentStatus: true,
  startDate: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
} satisfies Prisma.EmployeeSelect;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async generateEmployeeCode(tenantId: string): Promise<string> {
    const count = await this.prisma.employee.count({ where: { tenantId } });
    const next = count + 1;
    return `EMP-${String(next).padStart(5, '0')}`;
  }

  private buildScopeWhere(restriction?: EmployeeScopeRestriction): Prisma.EmployeeWhereInput {
    if (!restriction) return {};
    if (restriction.onlyEmployeeId) return { id: restriction.onlyEmployeeId };
    if (restriction.departmentId) return { departmentId: restriction.departmentId };
    return {};
  }

  async list(tenantId: string, query: QueryEmployeesDto, restriction?: EmployeeScopeRestriction) {
    const where: Prisma.EmployeeWhereInput = {
      tenantId,
      ...this.buildScopeWhere(restriction),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.positionId ? { positionId: query.positionId } : {}),
      ...(query.status ? { employmentStatus: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { employeeCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        select: EMPLOYEE_LIST_SELECT,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findOne(tenantId: string, id: string, restriction?: EmployeeScopeRestriction) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId, ...this.buildScopeWhere(restriction) },
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
        contact: true,
        emergencyContacts: true,
        directReports: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { id: true, status: true, lastLoginAt: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async create(params: { tenantId: string; dto: CreateEmployeeDto; actorUserId: string }) {
    const { dto } = params;
    const employeeCode = await this.generateEmployeeCode(params.tenantId);

    try {
      const employee = await this.prisma.employee.create({
        data: {
          tenantId: params.tenantId,
          employeeCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          departmentId: dto.departmentId,
          positionId: dto.positionId,
          managerId: dto.managerId,
          employmentType: dto.employmentType,
          startDate: new Date(dto.startDate),
          ...(dto.contact ? { contact: { create: dto.contact } } : {}),
          ...(dto.emergencyContacts?.length
            ? { emergencyContacts: { create: dto.emergencyContacts } }
            : {}),
        },
        include: { department: true, position: true },
      });

      await this.audit.record({
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: 'employee.created',
        resourceType: 'Employee',
        resourceId: employee.id,
        metadata: { employeeCode: employee.employeeCode, email: employee.email },
      });

      return employee;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An employee with this email already exists.');
      }
      throw error;
    }
  }

  async update(params: {
    tenantId: string;
    id: string;
    dto: UpdateEmployeeDto;
    actorUserId: string;
    restriction?: EmployeeScopeRestriction;
  }) {
    const existing = await this.findOne(params.tenantId, params.id, params.restriction);
    const { dto } = params;

    try {
      const employee = await this.prisma.employee.update({
        where: { id: existing.id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email ? dto.email.trim().toLowerCase() : undefined,
          phone: dto.phone,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          departmentId: dto.departmentId,
          positionId: dto.positionId,
          managerId: dto.managerId,
          employmentType: dto.employmentType,
          employmentStatus: dto.employmentStatus,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          ...(dto.contact
            ? {
                contact: {
                  upsert: {
                    create: dto.contact,
                    update: dto.contact,
                  },
                },
              }
            : {}),
        },
        include: { department: true, position: true, contact: true },
      });

      if (dto.emergencyContacts) {
        await this.prisma.emergencyContact.deleteMany({ where: { employeeId: employee.id } });
        if (dto.emergencyContacts.length > 0) {
          await this.prisma.emergencyContact.createMany({
            data: dto.emergencyContacts.map((c) => ({ ...c, employeeId: employee.id })),
          });
        }
      }

      await this.audit.record({
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action:
          dto.employmentStatus && dto.employmentStatus !== existing.employmentStatus
            ? 'employee.status_changed'
            : 'employee.updated',
        resourceType: 'Employee',
        resourceId: employee.id,
        metadata: { changes: JSON.parse(JSON.stringify({ ...dto, emergencyContacts: undefined })) },
      });

      return employee;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An employee with this email already exists.');
      }
      throw error;
    }
  }
}
