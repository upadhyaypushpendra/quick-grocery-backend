import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class IdentifierRateLimitGuard implements CanActivate {
  private store: Map<string, RateLimitRecord> = new Map();
  private readonly windowMs = 60 * 1000; // 1 minute
  private readonly maxRequests = 5; // 5 requests per minute

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const identifier = this.getIdentifier(request);

    if (!identifier) {
      throw new BadRequestException('Identifier is required');
    }

    const now = Date.now();
    const record = this.store.get(identifier);

    // Reset if window expired
    if (!record || now > record.resetTime) {
      this.store.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    // Check if limit exceeded
    if (record.count >= this.maxRequests) {
      const secondsRemaining = Math.ceil((record.resetTime - now) / 1000);
      throw new HttpException(
        `Too many requests. Please try again in ${secondsRemaining} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    record.count += 1;
    return true;
  }

  private getIdentifier(request: Request): string | null {
    try {
      const body = request.body;
      if (!body || typeof body.identifier !== 'string') {
        return null;
      }
      return body.identifier.toLowerCase().trim();
    } catch {
      return null;
    }
  }
}
