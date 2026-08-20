import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { EmptyToUndefined } from '../common/decorators/empty-to-undefined.decorator';

export class CreateSessionDto {
  @IsString() name!: string;
  // Capacity is NEVER client-supplied anymore — it's derived
  // automatically server-side from the gym's registered sensor count
  // (see SessionsService.create). Kept here only so an older client
  // build that still sends the field doesn't fail validation; the
  // value itself is always ignored.
  @IsOptional() @IsInt() @Min(1) capacity?: number;
  @EmptyToUndefined() @IsOptional() @IsDateString() scheduledAt?: string;
  // Planning-only end time — see Session.scheduledEndAt comment in the
  // schema. Purely for the calendar view; the live session's actual end
  // is still whatever the trainer sets when they end it.
  @EmptyToUndefined() @IsOptional() @IsDateString() scheduledEndAt?: string;
  // Branch Portal lets a front-desk manager assign ANY active trainer
  // at their gym, not just themselves. The Trainer App never sends
  // this — a trainer scheduling their own session defaults to
  // themselves (see SessionsService.create).
  @IsOptional() @IsString() trainerId?: string;
}

export class EnrollMemberDto {
  @IsString() memberId!: string;
}

export class CancelSessionDto {
  @IsOptional() @IsString() reason?: string;
}

export class SetAttendanceDto {
  @IsString() memberId!: string;
  @IsIn(['enrolled', 'attended', 'no_show']) attendance!: 'enrolled' | 'attended' | 'no_show';
}

export class SessionResultDto {
  @IsString() memberId!: string;
  @IsOptional() @IsInt() avgHr?: number;
  @IsOptional() @IsInt() maxHr?: number;
  @IsOptional() @IsNumber() calories?: number;
  @IsOptional() @IsObject() zoneMinutes?: Record<string, number>;
  @IsOptional() @IsNumber() score?: number;
}

export class EndSessionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionResultDto)
  results!: SessionResultDto[];
}

export class SensorReadingDto {
  @IsString() memberId!: string;
  @IsDateString() ts!: string;
  @IsInt() hr!: number;
  @IsOptional() @IsInt() rrMs?: number;
}

export class IngestSensorReadingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SensorReadingDto)
  readings!: SensorReadingDto[];
}
