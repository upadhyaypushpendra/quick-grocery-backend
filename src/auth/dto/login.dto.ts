import { IsNotEmpty, IsOptional, IsEnum, Matches } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

const LOGINABLE_ROLES = [
  UserRole.USER,
  UserRole.DELIVERY_PARTNER,
  UserRole.ADMIN,
] as const;
type LoginableRole = (typeof LOGINABLE_ROLES)[number];

export class LoginDto {
  @IsNotEmpty()
  @Matches(/^(\+?[\d\s\-()]{10,}|[^\s@]+@[^\s@]+\.[^\s@]+)$/, {
    message: 'Identifier must be a valid email or phone number',
  })
  identifier: string;

  @IsOptional()
  @IsEnum(LOGINABLE_ROLES, {
    message: `Role must be one of: ${LOGINABLE_ROLES.join(', ')}`,
  })
  role?: LoginableRole;
}
