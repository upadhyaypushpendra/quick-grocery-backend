import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User, UserRole, IdentifierType } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { Location } from '../location/entities/location.entity';
import { OtpService } from '../otp/otp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private tokenRepo: Repository<RefreshToken>,
    @InjectRepository(Location) private locationRepo: Repository<Location>,
    private otpService: OtpService,
  ) {}

  private detectIdentifierType(identifier: string): IdentifierType {
    // Simple check: if it contains @, it's email; otherwise it's phone
    return identifier.includes('@')
      ? IdentifierType.EMAIL
      : IdentifierType.PHONE;
  }

  async register(dto: RegisterDto) {
    const role = dto.role ?? UserRole.USER;

    const existing = await this.userRepo.findOne({
      where: { identifier: dto.identifier, role },
    });
    if (existing) {
      throw new ConflictException('User already exists');
    }

    const identifierType = this.detectIdentifierType(dto.identifier);

    const user = this.userRepo.create({
      identifier: dto.identifier,
      identifierType,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role,
    });

    await this.userRepo.save(user);

    // Generate OTP
    const otpResult = await this.otpService.generate(dto.identifier);

    return {
      message: 'User registered. OTP sent to your identifier.',
      identifier: dto.identifier,
      expiresIn: otpResult.expiresIn,
      otp: otpResult.otp, // Only for development/testing
    };
  }

  async login(dto: LoginDto) {
    const where = dto.role
      ? { identifier: dto.identifier, role: dto.role }
      : { identifier: dto.identifier };

    const user = await this.userRepo.findOne({ where });

    if (!user) {
      throw new BadRequestException(
        'Account not found. Please register before logging in.',
      );
    }

    // Generate OTP
    const otpResult = await this.otpService.generate(dto.identifier);

    return {
      message: `OTP sent to your ${user.identifierType.toLowerCase()}.`,
      identifier: dto.identifier,
      identifierType: user.identifierType,
      expiresIn: otpResult.expiresIn,
      otp: otpResult.otp, // Only for development/testing
    };
  }

  async verifyOtp(identifier: string, otp: string, role?: UserRole) {
    // Verify OTP
    await this.otpService.verify(identifier, otp);

    const where = role ? { identifier, role } : { identifier };
    let user = await this.userRepo.findOne({ where });

    if (!user) {
      // Auto-create user if doesn't exist
      const identifierType = this.detectIdentifierType(identifier);
      user = this.userRepo.create({
        identifier,
        identifierType,
        firstName: 'Guest',
        lastName: 'User',
        role: role ?? UserRole.USER,
      });
      await this.userRepo.save(user);
    }

    // Generate tokens
    return this.generateTokens(
      user.id,
      user.identifier,
      user.role,
      user.firstName,
      user.lastName,
    );
  }

  async refresh(refreshToken: string) {
    const refreshSecret =
      this.config.get<string>('jwt.refreshSecret') ||
      'dev_jwt_refresh_secret_do_not_use_in_production_12345';

    // Verify JWT signature
    let payload: { sub: string };
    try {
      payload = this.jwt.verify<{ sub: string }>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = payload.sub;
    const record = await this.tokenRepo.findOne({
      where: { userId, revoked: false },
    });

    if (!record || !record.expiresAt || new Date() > record.expiresAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Compare token hash with stored hash
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    if (tokenHash !== record.tokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke old token
    await this.tokenRepo.update(record.id, { revoked: true });

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.generateTokens(
      user.id,
      user.identifier,
      user.role,
      user.firstName,
      user.lastName,
    );
  }

  async logout(userId: string) {
    await this.tokenRepo.update({ userId }, { revoked: true });
    await this.locationRepo.update({ userId }, { isTracking: false });
  }

  private async generateTokens(
    userId: string,
    identifier: string,
    role: string,
    firstName?: string,
    lastName?: string,
  ) {
    const payload = { sub: userId, identifier, role, firstName, lastName };
    const secret =
      this.config.get<string>('jwt.secret') ||
      'dev_jwt_secret_do_not_use_in_production_12345';
    const refreshSecret =
      this.config.get<string>('jwt.refreshSecret') ||
      'dev_jwt_refresh_secret_do_not_use_in_production_12345';

    const accessToken = this.jwt.sign(payload, {
      secret,
      expiresIn: '1h',
    });

    const refreshPayload = {
      ...payload,
      version: crypto.randomBytes(4).toString('hex'),
    };
    const refreshTokenPlain = this.jwt.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: '7d',
    });

    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshTokenPlain)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.tokenRepo.save({
      userId,
      tokenHash: refreshTokenHash,
      expiresAt,
      revoked: false,
    });

    return {
      accessToken,
      refreshToken: refreshTokenPlain,
    };
  }
}
