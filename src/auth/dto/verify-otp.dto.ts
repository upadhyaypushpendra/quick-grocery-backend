import { IsNotEmpty, IsOptional, IsEnum, Length } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

const VERIFIABLE_ROLES = [
  UserRole.USER,
  UserRole.DELIVERY_PARTNER,
  UserRole.ADMIN,
] as const;
type VerifiableRole = (typeof VERIFIABLE_ROLES)[number];

export class VerifyOtpDto {
  @IsNotEmpty()
  identifier: string;

  @IsNotEmpty()
  @Length(6, 6)
  otp: string;

  @IsOptional()
  @IsEnum(VERIFIABLE_ROLES, {
    message: `Role must be one of: ${VERIFIABLE_ROLES.join(', ')}`,
  })
  role?: VerifiableRole;
}
