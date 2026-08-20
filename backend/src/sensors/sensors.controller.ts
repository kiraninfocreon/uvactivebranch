import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth, CurrentUser, AuthenticatedUser } from '../common/decorators/auth.decorator';
import { SensorsService } from './sensors.service';
import { CreateSensorDto, UpdateSensorDto } from './sensors.dto';

@ApiTags('branch/sensors')
@Controller('branch/sensors')
@Auth('staff', ['branch_manager'])
export class BranchSensorsController {
  constructor(private readonly sensors: SensorsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sensors.listForGym(user.gymId!);
  }

  @Post()
  create(@Body() dto: CreateSensorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sensors.create(user.gymId!, dto, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSensorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sensors.update(id, user.gymId!, dto, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sensors.delete(id, user.gymId!, user.sub);
  }
}

@ApiTags('admin/sensors')
@Controller('admin/sensors')
@Auth('admin')
export class AdminSensorsController {
  constructor(private readonly sensors: SensorsService) {}

  @Get()
  listAll() {
    return this.sensors.listAllForAdmin();
  }
}
