import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { EmptyToUndefined } from '../common/decorators/empty-to-undefined.decorator';

export class CreateGymDto {
  @IsString() name!: string;
  @IsString() address!: string;
  @IsString() location!: string;
  @IsString() gymPhone!: string;
  @IsOptional() @IsString() ownerContact?: string;
  // The Admin Panel's "Create Gym" form has no input for this field —
  // it's always submitted as "" from GymFormValues' default state.
  // @IsOptional() alone does not skip @IsEmail() for an empty string
  // (only null/undefined), so every gym creation was failing
  // validation with "contactEmail must be an email". EmptyToUndefined
  // normalizes "" to undefined before @IsOptional() runs.
  @EmptyToUndefined() @IsOptional() @IsEmail() contactEmail?: string;
  @IsInt() @Min(1) memberLimit!: number;

  // A gym is useless without someone who can log in to run it — this is
  // NOT optional. Creating the Gym row without also creating its
  // branch-manager staff account was the original bug: admins could
  // create a gym that no one could ever log into. One request, one
  // gym, one login.
  @IsString() managerName!: string;
  @IsEmail() managerEmail!: string;
  // Mandatory on gym creation per spec — every other field on this
  // form is mandatory too, and a manager account with no contact
  // number on file was a support-recovery dead end in practice.
  @IsString() managerPhone!: string;
}

// Settings screen (Branch Portal) — deliberately excludes memberLimit
// (Admin-controlled cap) and the manager's own email/phone (those live
// on the Trainer row and are admin-only to change — spec: "not the
// email id of manager and phone number, cannot get changed only by
// admin can do"). Gym name/address/location/gymPhone ARE branch-
// editable per that same spec section.
export class UpdateGymProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() gymPhone?: string;
  @IsOptional() @IsString() ownerContact?: string;
  @EmptyToUndefined() @IsOptional() @IsEmail() contactEmail?: string;
}
export class UpdateGymDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() gymPhone?: string;
  @IsOptional() @IsString() ownerContact?: string;
  @EmptyToUndefined() @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsInt() @Min(1) memberLimit?: number;
}

// Lets an admin (from the Gyms screen) issue a brand-new temporary
// password for a branch's primary manager account, e.g. if the
// original credentials email never arrived. Returns the plaintext
// once, same shape as gym creation.
export class ResetGymManagerPasswordDto {
  @IsOptional() @IsString() @MinLength(8) newPassword?: string;
}

// Admin-only editing of the manager account itself (name/email/phone)
// — distinct from ResetGymManagerPasswordDto above (credentials) and
// from UpdateGymProfileDto (the gym row). Spec: "not the email id of
// manager and phone number, cannot get changed only by admin can do" —
// this DTO is that admin-only path, reached from the Gyms screen's
// "Edit Gym" flow.
export class UpdateGymManagerDto {
  @IsOptional() @IsString() name?: string;
  @EmptyToUndefined() @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
}
