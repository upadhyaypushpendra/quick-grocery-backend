import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSubscription } from './entities/push-subscription.entity';
import { RegisterPushDto } from './dto/register-push.dto';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushService {
  constructor(
    @InjectRepository(PushSubscription)
    private pushSubRepo: Repository<PushSubscription>,
    private config: ConfigService,
  ) {
    webpush.setVapidDetails(
      this.config.get<string>('vapid.subject')!,
      this.config.get<string>('vapid.publicKey')!,
      this.config.get<string>('vapid.privateKey')!,
    );
  }

  async subscribe(
    userId: string,
    dto: RegisterPushDto,
  ): Promise<PushSubscription> {
    const existing = await this.pushSubRepo.findOne({
      where: { userId, endpoint: dto.endpoint },
    });
    if (existing) {
      existing.keys = dto.keys;
      return this.pushSubRepo.save(existing);
    }
    return this.pushSubRepo.save(
      this.pushSubRepo.create({
        userId,
        endpoint: dto.endpoint,
        keys: dto.keys,
      }),
    );
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.pushSubRepo.delete({ userId, endpoint });
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const subs = await this.pushSubRepo.find({ where: { userId } });
    if (subs.length === 0) return;

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload),
        ),
      ),
    );

    // Remove stale subscriptions (410 Gone or 404 Not Found)
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        const err = result.reason as { statusCode?: number };
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.pushSubRepo.delete({ id: subs[i].id });
        }
      }
    }
  }

  getVapidPublicKey(): string {
    return this.config.get<string>('vapid.publicKey')!;
  }
}
