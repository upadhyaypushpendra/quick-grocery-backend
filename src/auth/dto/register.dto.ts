import { IsNotEmpty, IsOptional, IsEnum, Matches } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

// Only these roles can self-register — admin must be created manually
const REGISTRABLE_ROLES = [UserRole.USER, UserRole.DELIVERY_PARTNER] as const;
type RegistrableRole = (typeof REGISTRABLE_ROLES)[number];

export class RegisterDto {
  @IsNotEmpty()
  @Matches(/^(\+?[\d\s\-()]{10,}|[^\s@]+@[^\s@]+\.[^\s@]+)$/, {
    message: 'Identifier must be a valid email or phone number',
  })
  identifier: string;

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsEnum(REGISTRABLE_ROLES, {
    message: `Role must be one of: ${REGISTRABLE_ROLES.join(', ')}`,
  })
  role?: RegistrableRole;
}
