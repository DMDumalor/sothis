import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCompensationDto } from './dto/create-compensation.dto';

@Injectable()
export class CompensationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listSalaryStructures(tenantId: string) {
    return this.prisma.salaryStructure.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  /** Full compensation history for one employee, most recent first. */
  async listForEmployee(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.employeeCompensation.findMany({
      where: { tenantId, employeeId },
      include: { salaryStructure: { select: { id: true, name: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /** The currently-active compensation record (effectiveTo null, or covering "now"). */
  async getCurrentForEmployee(tenantId: string, employeeId: string) {
    const now = new Date();
    return this.prisma.employeeCompensation.findFirst({
      where: {
        tenantId,
        employeeId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Records a new salary, closing out whichever prior record was still
   * open (effectiveTo null) so the two never overlap. Never mutates or
   * deletes the prior record's baseSalary — compensation is an append-only
   * history, per spec's audit-everything posture for payroll-adjacent data.
   */
  async create(params: { tenantId: string; dto: CreateCompensationDto; actorUserId: string }) {
    const { tenantId, dto, actorUserId } = params;

    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('Invalid effective date.');
    }

    if (dto.salaryStructureId) {
      const structure = await this.prisma.salaryStructure.findFirst({
        where: { id: dto.salaryStructureId, tenantId },
      });
      if (!structure) throw new BadRequestException('Salary structure not found.');
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const openPrior = await tx.employeeCompensation.findFirst({
        where: { tenantId, employeeId: dto.employeeId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (openPrior) {
        if (openPrior.effectiveFrom >= effectiveFrom) {
          throw new BadRequestException(
            'The new effective date must be after the current compensation record\'s effective date.',
          );
        }
        await tx.employeeCompensation.update({
          where: { id: openPrior.id },
          data: { effectiveTo: effectiveFrom },
        });
      }

      return tx.employeeCompensation.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          baseSalary: dto.baseSalary,
          currency: dto.currency ?? 'GHS',
          effectiveFrom,
          salaryStructureId: dto.salaryStructureId,
          createdById: actorUserId,
        },
      });
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'compensation.created',
      resourceType: 'EmployeeCompensation',
      resourceId: record.id,
      metadata: { employeeId: dto.employeeId, baseSalary: dto.baseSalary, effectiveFrom: dto.effectiveFrom },
    });

    return record;
  }
}
