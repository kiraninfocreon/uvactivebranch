import { IsOptional, IsString } from 'class-validator';

export class CreateSensorDto {
  @IsString() name!: string;
  @IsString() sensorId!: string;
  @IsOptional() @IsString() note?: string;
}

export class UpdateSensorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() sensorId?: string;
  @IsOptional() @IsString() note?: string;
}
