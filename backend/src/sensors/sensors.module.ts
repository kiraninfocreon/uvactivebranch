import { Module } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { BranchSensorsController, AdminSensorsController } from './sensors.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  providers: [SensorsService],
  controllers: [BranchSensorsController, AdminSensorsController],
  exports: [SensorsService],
})
export class SensorsModule {}
