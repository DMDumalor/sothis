import { Module } from '@nestjs/common';
import { OvertimeController } from './overtime.controller';
import { OvertimeService } from './overtime.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OvertimeController],
  providers: [OvertimeService],
  exports: [OvertimeService],
})
export class OvertimeModule {}
