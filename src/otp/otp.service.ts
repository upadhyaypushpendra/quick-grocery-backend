import { Injectable, BadRequestException, UnauthorizedException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { type Cache } from 'cache-manager';

const VALID_OTP = '123456'; // Fixed OTP for development
const OTP_EXPIRY = 10 * 60; // 10 minutes in seconds
const OTP_KEY_PREFIX = 'otp:';
const OTP_ATTEMPTS_KEY_PREFIX = 'otp:attempts:';
const MAX_ATTEMPTS = 3;

interface OtpData {
  otp: string;
  createdAt: number;
}

@Injectable()
export class OtpService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  private generateOtp(): string {
    // In production, generate random 6-digit OTP
    // For now, return fixed VALID_OTP for testing
    return VALID_OTP;
  }

  private getOtpKey(identifier: string): string {
    return `${OTP_KEY_PREFIX}${identifier.toLowerCase()}`;
  }

  private getAttemptsKey(identifier: string): string {
    return `${OTP_ATTEMPTS_KEY_PREFIX}${identifier.toLowerCase()}`;
  }

  async generate(
    identifier: string,
  ): Promise<{ otp: string; expiresIn: number }> {
    const otp = this.generateOtp();
    const otpKey = this.getOtpKey(identifier);
    const attemptsKey = this.getAttemptsKey(identifier);

    // Store OTP in Redis with TTL (10 minutes)
    const otpData: OtpData = {
      otp,
      createdAt: Date.now(),
    };

    await this.cacheManager.set(
      otpKey,
      JSON.stringify(otpData),
      OTP_EXPIRY * 1000,
    );
    // Reset attempts counter
    await this.cacheManager.set(attemptsKey, 0, OTP_EXPIRY * 1000);

    return {
      otp,
      expiresIn: OTP_EXPIRY,
    };
  }

  async verify(identifier: string, otp: string): Promise<boolean> {
    const otpKey = this.getOtpKey(identifier);
    const attemptsKey = this.getAttemptsKey(identifier);

    // Get OTP from Redis
    const storedOtpStr = await this.cacheManager.get<string>(otpKey);

    if (!storedOtpStr) {
      throw new BadRequestException('OTP not found. Please request a new one.');
    }

    const storedOtpData: OtpData = JSON.parse(storedOtpStr);

    // Get attempts
    const attempts = (await this.cacheManager.get<number>(attemptsKey)) || 0;

    if (attempts >= MAX_ATTEMPTS) {
      // Delete OTP after max attempts exceeded
      await this.cacheManager.del(otpKey);
      await this.cacheManager.del(attemptsKey);
      throw new UnauthorizedException(
        'Maximum OTP attempts exceeded. Please request a new one.',
      );
    }

    if (storedOtpData.otp !== otp) {
      // Increment attempts
      const newAttempts = attempts + 1;
      await this.cacheManager.set(attemptsKey, newAttempts, OTP_EXPIRY * 1000);
      throw new BadRequestException(
        `Invalid OTP. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`,
      );
    }

    // OTP verified successfully, delete both OTP and attempts
    await this.cacheManager.del(otpKey);
    await this.cacheManager.del(attemptsKey);
    return true;
  }

  async resend(
    identifier: string,
  ): Promise<{ otp: string; expiresIn: number }> {
    // Delete existing OTP and attempts if any
    const otpKey = this.getOtpKey(identifier);
    const attemptsKey = this.getAttemptsKey(identifier);
    await this.cacheManager.del(otpKey);
    await this.cacheManager.del(attemptsKey);

    // Generate new OTP
    return this.generate(identifier);
  }
}
