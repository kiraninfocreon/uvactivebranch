import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsReassignmentJob } from './sessions.reassignment.job';
import { TrainerSessionsController, BranchSessionsController, MemberSessionsController, AdminSessionsController } from './sessions.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SensorsModule } from '../sensors/sensors.module';

@Module({
  imports: [AuditLogModule, NotificationsModule, SensorsModule],
  providers: [SessionsService, SessionsReassignmentJob],
  controllers: [TrainerSessionsController, BranchSessionsController, MemberSessionsController, AdminSessionsController],
  exports: [SessionsService],
})
export class SessionsModule {}
