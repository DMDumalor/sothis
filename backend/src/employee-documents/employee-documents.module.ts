import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmployeesModule } from '../employees/employees.module';
import { EmployeeDocumentsController } from './employee-documents.controller';
import { EmployeeDocumentsService } from './employee-documents.service';

@Module({
  imports: [AuthModule, EmployeesModule],
  controllers: [EmployeeDocumentsController],
  providers: [EmployeeDocumentsService],
})
export class EmployeeDocumentsModule {}
