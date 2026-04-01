import { IsNotEmpty, Matches, Length } from 'class-validator';

export class GenerateOtpDto {
  @IsNotEmpty()
  @Matches(/^(\+?[\d\s\-()]{10,}|[^\s@]+@[^\s@]+\.[^\s@]+)$/, {
    message: 'Identifier must be a valid email or phone number',
  })
  identifier: string;
}

export class VerifyOtpDto {
  @IsNotEmpty()
  identifier: string;

  @IsNotEmpty()
  @Length(6, 6)
  otp: string;
}

export class ResendOtpDto {
  @IsNotEmpty()
  identifier: string;
}
