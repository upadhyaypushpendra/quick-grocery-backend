import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { OtpService } from './otp.service';
import { GenerateOtpDto, VerifyOtpDto, ResendOtpDto } from './dto/otp.dto';
import { IdentifierRateLimitGuard } from './guards/identifier-rate-limit.guard';

@Controller('otp')
export class OtpController {
  constructor(private otpService: OtpService) {}

  @Post('generate')
  @UseGuards(IdentifierRateLimitGuard)
  async generate(@Body() dto: GenerateOtpDto) {
    const result = await this.otpService.generate(dto.identifier);
    return {
      message: 'OTP generated and sent',
      identifier: dto.identifier,
      expiresIn: result.expiresIn,
      otp: result.otp, // Only for development
    };
  }

  @Post('verify')
  @UseGuards(IdentifierRateLimitGuard)
  async verify(@Body() dto: VerifyOtpDto) {
    await this.otpService.verify(dto.identifier, dto.otp);
    return {
      message: 'OTP verified successfully',
      identifier: dto.identifier,
    };
  }

  @Post('resend')
  @UseGuards(IdentifierRateLimitGuard)
  async resend(@Body() dto: ResendOtpDto) {
    const result = await this.otpService.resend(dto.identifier);
    return {
      message: 'New OTP generated and sent',
      identifier: dto.identifier,
      expiresIn: result.expiresIn,
      otp: result.otp, // Only for development
    };
  }
}
