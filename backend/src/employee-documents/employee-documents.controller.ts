import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { PermissionScope } from '@prisma/client';
import { EmployeeDocumentsService } from './employee-documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GrantedScope } from '../common/decorators/granted-scope.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { ScopeService } from '../rbac/scope.service';
import { AuthenticatedPrincipal } from '../common/interfaces/authenticated-request.interface';

/**
 * Multer stays on memory storage with tight limits (single file, small
 * field count/size) — this bounds the resource-exhaustion surface of the
 * known multer advisories regardless of the exact patch version, since the
 * service itself performs the real size/mimetype validation before ever
 * touching disk.
 */
const MULTER_LIMITS = {
  fileSize: 10 * 1024 * 1024,
  files: 1,
  fields: 5,
  fieldNameSize: 100,
  fieldSize: 1024,
  parts: 10,
};

@ApiTags('employee-documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('employees/:employeeId/documents')
export class EmployeeDocumentsController {
  constructor(
    private readonly documentsService: EmployeeDocumentsService,
    private readonly scopeService: ScopeService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_DOCUMENT_READ)
  @ApiOperation({ summary: 'List documents for an employee' })
  async list(
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.documentsService.list(user.tenantId, employeeId, restriction);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_DOCUMENT_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document for an employee' })
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: MULTER_LIMITS }),
  )
  async upload(
    @Param('employeeId') employeeId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    return this.documentsService.upload({
      tenantId: user.tenantId,
      employeeId,
      dto,
      file,
      actorUserId: user.userId,
      restriction,
    });
  }

  @Get(':documentId/download')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_DOCUMENT_READ)
  @ApiOperation({ summary: 'Download a document (streamed, never a public URL)' })
  async download(
    @Param('employeeId') employeeId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @Res({ passthrough: true }) res: Response,
    @GrantedScope() scope?: PermissionScope,
  ): Promise<StreamableFile> {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    const { document, absolutePath } = await this.documentsService.getForDownload(
      user.tenantId,
      employeeId,
      documentId,
      restriction,
    );
    res.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${document.fileName}"`,
    });
    return new StreamableFile(createReadStream(absolutePath));
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.EMPLOYEE_DOCUMENT_DELETE)
  @ApiOperation({ summary: 'Soft-delete a document' })
  async remove(
    @Param('employeeId') employeeId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @GrantedScope() scope?: PermissionScope,
  ) {
    const restriction = await this.scopeService.resolveScopeRestriction(user, scope);
    await this.documentsService.softDelete({
      tenantId: user.tenantId,
      employeeId,
      documentId,
      actorUserId: user.userId,
      restriction,
    });
  }
}
