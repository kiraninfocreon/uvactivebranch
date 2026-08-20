import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateSensorDto, UpdateSensorDto } from './sensors.dto';

@Injectable()
export class SensorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  listForGym(gymId: string) {
    return this.prisma.sensor.findMany({ where: { gymId }, orderBy: { createdAt: 'asc' } });
  }

  // The number of registered sensors IS the session-enrollment cap
  // (spec: "already added sensors slots if 6 they can add only 6
  // members ... above that not permit") — sessions.service reads this
  // directly when validating capacity.
  countForGym(gymId: string) {
    return this.prisma.sensor.count({ where: { gymId } });
  }

  async create(gymId: string, dto: CreateSensorDto, actorTrainerId: string) {
    const existing = await this.prisma.sensor.findFirst({ where: { gymId, sensorId: dto.sensorId } });
    if (existing) throw new ConflictException('A sensor with this Sensor ID is already registered at your gym.');

    const sensor = await this.prisma.sensor.create({ data: { gymId, name: dto.name, sensorId: dto.sensorId, note: dto.note } });
    await this.auditLog.record({ actorType: 'staff', actorId: actorTrainerId, action: 'sensor.create', targetType: 'sensor', targetId: sensor.id, payload: { gymId, sensorId: dto.sensorId } });
    return sensor;
  }

  async update(id: string, gymId: string, dto: UpdateSensorDto, actorTrainerId: string) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor || sensor.gymId !== gymId) throw new NotFoundException('Sensor not found.');

    if (dto.sensorId && dto.sensorId !== sensor.sensorId) {
      const clash = await this.prisma.sensor.findFirst({ where: { gymId, sensorId: dto.sensorId, NOT: { id } } });
      if (clash) throw new ConflictException('A sensor with this Sensor ID is already registered at your gym.');
    }

    const updated = await this.prisma.sensor.update({ where: { id }, data: dto });
    await this.auditLog.record({ actorType: 'staff', actorId: actorTrainerId, action: 'sensor.update', targetType: 'sensor', targetId: id, payload: { gymId } });
    return updated;
  }

  async delete(id: string, gymId: string, actorTrainerId: string) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor || sensor.gymId !== gymId) throw new NotFoundException('Sensor not found.');

    await this.prisma.sensor.delete({ where: { id } });
    await this.auditLog.record({ actorType: 'staff', actorId: actorTrainerId, action: 'sensor.delete', targetType: 'sensor', targetId: id, payload: { gymId } });
    return { deleted: true };
  }

  // Admin Panel — read-only visibility across every gym's sensor
  // inventory (spec: "Sensor tab should be there ... to see all the
  // sensors id name" on the admin side too).
  listAllForAdmin() {
    return this.prisma.sensor.findMany({ include: { gym: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  }
}
