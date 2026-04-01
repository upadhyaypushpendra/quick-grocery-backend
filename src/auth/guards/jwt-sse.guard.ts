import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtSseGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Try to get token from Authorization header first
    const authHeader = request.headers.authorization;
    let token: string;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (request.query.token) {
      // Fall back to query parameter for SSE
      token = request.query.token;
    } else {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const secret =
        this.config.get<string>('jwt.secret') ||
        'dev_jwt_secret_do_not_use_in_production_12345';
      const payload = this.jwt.verify(token, { secret });
      request.user = payload;
      return true;
    } catch (err) {
      console.error(
        '[JwtSseGuard] Token verification failed:',
        (err as Error).message,
      );
      throw new UnauthorizedException('Invalid token');
    }
  }
}
