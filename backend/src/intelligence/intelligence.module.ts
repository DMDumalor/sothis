import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService } from './intelligence.service';

@Module({
  imports: [AuthModule],
  controllers: [IntelligenceController],
  providers: [IntelligenceService],
  exports: [IntelligenceService],
})
export class IntelligenceModule {}
