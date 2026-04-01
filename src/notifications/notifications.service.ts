import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Subject } from 'rxjs';

@Injectable()
export class NotificationsService {
  private streams = new Map<string, Subject<MessageEvent>>();

  getStream(orderId: string): Subject<MessageEvent> {
    let stream = this.streams.get(orderId);
    if (!stream) {
      stream = new Subject<MessageEvent>();
      this.streams.set(orderId, stream);
    }
    return stream;
  }

  @OnEvent('order.status_updated')
  handleStatusUpdate(payload: {
    orderId: string;
    status: string;
    timestamp: Date;
  }) {
    const stream = this.streams.get(payload.orderId);
    if (stream) {
      stream.next({
        data: JSON.stringify(payload),
      } as any);
    }
  }

  closeStream(orderId: string) {
    const stream = this.streams.get(orderId);
    if (stream) {
      stream.complete();
      this.streams.delete(orderId);
    }
  }
}
