import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { AuthModule } from '../auth/auth.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [AuthModule, IntelligenceModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
