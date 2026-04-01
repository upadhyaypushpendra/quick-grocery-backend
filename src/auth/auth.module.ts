import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { Location } from '../location/entities/location.entity';
import { OtpModule } from '../otp/otp.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtSseGuard } from './guards/jwt-sse.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([User, RefreshToken, Location]),
    OtpModule,
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, JwtSseGuard, RolesGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, JwtSseGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
