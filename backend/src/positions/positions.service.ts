import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, departmentId?: string) {
    return this.prisma.position.findMany({
      where: { tenantId, ...(departmentId ? { departmentId } : {}) },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { title: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const position = await this.prisma.position.findFirst({
      where: { id, tenantId },
      include: { department: { select: { id: true, name: true } } },
    });
    if (!position) throw new NotFoundException('Position not found');
    return position;
  }

  async create(params: { tenantId: string; dto: CreatePositionDto; actorUserId: string }) {
    try {
      const position = await this.prisma.position.create({
        data: { tenantId: params.tenantId, ...params.dto },
      });
      await this.audit.record({
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: 'position.created',
        resourceType: 'Position',
        resourceId: position.id,
        metadata: { title: position.title, code: position.code },
      });
      return position;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A position with this code already exists.');
      }
      throw error;
    }
  }

  async update(params: { tenantId: string; id: string; dto: UpdatePositionDto; actorUserId: string }) {
    const existing = await this.findOne(params.tenantId, params.id);
    try {
      const position = await this.prisma.position.update({
        where: { id: existing.id },
        data: params.dto,
      });
      await this.audit.record({
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: 'position.updated',
        resourceType: 'Position',
        resourceId: position.id,
        metadata: { changes: JSON.parse(JSON.stringify(params.dto)) },
      });
      return position;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A position with this code already exists.');
      }
      throw error;
    }
  }
}
