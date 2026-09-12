import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeesService, EmployeeScopeRestriction } from '../employees/employees.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ALLOWED_DOCUMENT_MIME_TYPES } from './employee-documents.constants';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class EmployeeDocumentsService {
  private readonly uploadsRoot: string;
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employeesService: EmployeesService,
    private readonly config: ConfigService,
  ) {
    const configuredDir = this.config.get<string>('uploads.directory')!;
    this.uploadsRoot = path.isAbsolute(configuredDir)
      ? configuredDir
      : path.join(process.cwd(), configuredDir);
    this.maxFileSizeBytes = this.config.get<number>('uploads.maxFileSizeBytes')!;
  }

  /** Verifies the employee exists within tenant + scope; throws 404 otherwise. */
  private async assertEmployeeAccessible(
    tenantId: string,
    employeeId: string,
    restriction?: EmployeeScopeRestriction,
  ) {
    await this.employeesService.findOne(tenantId, employeeId, restriction);
  }

  async list(
    tenantId: string,
    employeeId: string,
    restriction?: EmployeeScopeRestriction,
  ) {
    await this.assertEmployeeAccessible(tenantId, employeeId, restriction);
    return this.prisma.employeeDocument.findMany({
      where: { tenantId, employeeId, deletedAt: null },
      select: {
        id: true,
        type: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        expiryDate: true,
        uploadedById: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async upload(params: {
    tenantId: string;
    employeeId: string;
    dto: UploadDocumentDto;
    file: UploadedFileLike;
    actorUserId: string;
    restriction?: EmployeeScopeRestriction;
  }) {
    const { tenantId, employeeId, dto, file, actorUserId, restriction } = params;
    await this.assertEmployeeAccessible(tenantId, employeeId, restriction);

    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed types: PDF, JPEG, PNG, DOC, DOCX.`,
      );
    }
    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `File exceeds the maximum allowed size of ${Math.floor(this.maxFileSizeBytes / (1024 * 1024))}MB.`,
      );
    }

    // Storage key is a random UUID, not derived from the client-supplied
    // filename — never trust it for path construction (path traversal).
    const extension = this.safeExtension(file.originalname);
    const storageKey = `${randomUUID()}${extension}`;
    const tenantDir = path.join(this.uploadsRoot, tenantId, employeeId);
    await fs.mkdir(tenantDir, { recursive: true });
    const absolutePath = path.join(tenantDir, storageKey);
    await fs.writeFile(absolutePath, file.buffer);

    try {
      const document = await this.prisma.employeeDocument.create({
        data: {
          tenantId,
          employeeId,
          type: dto.type,
          fileName: this.sanitizeDisplayName(file.originalname),
          storageKey: path.join(tenantId, employeeId, storageKey),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
          uploadedById: actorUserId,
        },
      });

      await this.audit.record({
        tenantId,
        actorUserId,
        action: 'employee.document.uploaded',
        resourceType: 'EmployeeDocument',
        resourceId: document.id,
        metadata: { employeeId, fileName: document.fileName, type: document.type },
      });

      const { storageKey: _omit, ...safeDocument } = document;
      return safeDocument;
    } catch (error) {
      // Roll back the file write if the DB record could not be created.
      await fs.unlink(absolutePath).catch(() => undefined);
      throw error;
    }
  }

  async getForDownload(
    tenantId: string,
    employeeId: string,
    documentId: string,
    restriction?: EmployeeScopeRestriction,
  ) {
    await this.assertEmployeeAccessible(tenantId, employeeId, restriction);
    const document = await this.prisma.employeeDocument.findFirst({
      where: { id: documentId, tenantId, employeeId, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Document not found');

    const absolutePath = path.join(this.uploadsRoot, document.storageKey);
    // Defense in depth: confirm the resolved path is still inside the
    // uploads root before opening it.
    if (!absolutePath.startsWith(path.resolve(this.uploadsRoot))) {
      throw new NotFoundException('Document not found');
    }
    return { document, absolutePath };
  }

  async softDelete(params: {
    tenantId: string;
    employeeId: string;
    documentId: string;
    actorUserId: string;
    restriction?: EmployeeScopeRestriction;
  }) {
    const { tenantId, employeeId, documentId, actorUserId, restriction } = params;
    await this.assertEmployeeAccessible(tenantId, employeeId, restriction);

    const document = await this.prisma.employeeDocument.findFirst({
      where: { id: documentId, tenantId, employeeId, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Document not found');

    await this.prisma.employeeDocument.update({
      where: { id: document.id },
      data: { deletedAt: new Date() },
    });

    const absolutePath = path.join(this.uploadsRoot, document.storageKey);
    await fs.unlink(absolutePath).catch(() => undefined);

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'employee.document.deleted',
      resourceType: 'EmployeeDocument',
      resourceId: document.id,
      metadata: { employeeId, fileName: document.fileName },
    });
  }

  private safeExtension(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    // Only allow a short, alphanumeric extension; anything else is dropped.
    return /^\.[a-z0-9]{1,6}$/.test(ext) ? ext : '';
  }

  private sanitizeDisplayName(originalName: string): string {
    const base = path.basename(originalName);
    return base.replace(/[^\w.\- ]/g, '_').slice(0, 180) || 'document';
  }
}
