import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { MailModule } from './mail/mail.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { DepartmentsModule } from './departments/departments.module';
import { PositionsModule } from './positions/positions.module';
import { EmployeesModule } from './employees/employees.module';
import { EmployeeDocumentsModule } from './employee-documents/employee-documents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LeaveModule } from './leave/leave.module';
import { AttendanceModule } from './attendance/attendance.module';
import { OvertimeModule } from './overtime/overtime.module';
import { CompensationModule } from './compensation/compensation.module';
import { PayrollModule } from './payroll/payroll.module';
import { SecurityModule } from './security/security.module';
import { ReportsModule } from './reports/reports.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttlSeconds')! * 1000,
            limit: config.get<number>('throttle.limit')!,
          },
        ],
      }),
    }),
    PrismaModule,
    AuditModule,
    MailModule,
    TenantModule,
    AuthModule,
    RbacModule,
    DepartmentsModule,
    PositionsModule,
    EmployeesModule,
    EmployeeDocumentsModule,
    NotificationsModule,
    LeaveModule,
    AttendanceModule,
    OvertimeModule,
    CompensationModule,
    PayrollModule,
    SecurityModule,
    ReportsModule,
    IntelligenceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
