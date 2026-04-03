import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from 'rxjs';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order.entity';
import { PushService, PushPayload } from './push.service';

const PUSH_MESSAGES: Record<OrderStatus, { title: string; body: string }> = {
  [OrderStatus.PENDING]:          { title: 'Order Placed',        body: 'Your order has been placed and is awaiting confirmation.' },
  [OrderStatus.ACCEPTED]:         { title: 'Order Accepted',      body: 'A delivery partner has accepted your order!' },
  [OrderStatus.GOING_FOR_PICKUP]: { title: 'Heading to Store',    body: 'Your delivery partner is on the way to pick up your groceries.' },
  [OrderStatus.OUT_FOR_DELIVERY]: { title: 'Out for Delivery',    body: 'Your groceries are on the way to you!' },
  [OrderStatus.REACHED]:          { title: 'Driver Has Arrived',  body: 'Your delivery partner has arrived at your location.' },
  [OrderStatus.DELIVERED]:        { title: 'Order Delivered',     body: 'Your order has been delivered. Enjoy your groceries!' },
  [OrderStatus.CANCELLED]:        { title: 'Order Cancelled',     body: 'Your order has been cancelled.' },
};

@Injectable()
export class NotificationsService {
  // Per-order streams for customer order tracking
  private streams = new Map<string, Subject<MessageEvent>>();
  // Per-DP streams for assigned orders list
  private dpStreams = new Map<string, Subject<MessageEvent>>();

  constructor(
    private pushService: PushService,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
  ) {}

  getStream(orderId: string): Subject<MessageEvent> {
    let stream = this.streams.get(orderId);
    if (!stream) {
      stream = new Subject<MessageEvent>();
      this.streams.set(orderId, stream);
    }
    return stream;
  }

  getDpStream(dpId: string): Subject<MessageEvent> {
    let stream = this.dpStreams.get(dpId);
    if (!stream) {
      stream = new Subject<MessageEvent>();
      this.dpStreams.set(dpId, stream);
    }
    return stream;
  }

  private async pushAssignedOrders(dpId: string) {
    const stream = this.dpStreams.get(dpId);
    if (!stream) return;
    const orders = await this.orderRepo.find({
      where: { deliveryPartnerId: dpId },
      relations: ['items', 'statusHistory'],
      order: { createdAt: 'DESC' },
    });
    stream.next({ data: JSON.stringify({ type: 'orders', orders }) } as any);
  }

  @OnEvent('order.status_updated')
  async handleStatusUpdate(payload: {
    orderId: string;
    status: string;
    timestamp: Date;
  }) {
    // SSE: push to any open browser connections for the customer
    const stream = this.streams.get(payload.orderId);
    if (stream) {
      stream.next({
        data: JSON.stringify(payload),
      } as any);
    }

    const order = await this.orderRepo.findOne({ where: { id: payload.orderId } });
    if (!order) return;

    // SSE: push updated orders list to the assigned DP
    if (order.deliveryPartnerId) {
      await this.pushAssignedOrders(order.deliveryPartnerId);
    }

    // Web push: notify customer even when app is closed
    const msg = PUSH_MESSAGES[payload.status as OrderStatus] ?? {
      title: 'Order Update',
      body: `Your order status has changed to ${payload.status}.`,
    };

    const pushPayload: PushPayload = {
      title: msg.title,
      body: msg.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: {
        orderId: payload.orderId,
        status: payload.status,
        url: `/orders/${payload.orderId}`,
      },
    };

    await this.pushService.sendToUser(order.userId, pushPayload);
  }

  @OnEvent('order.accepted')
  async handleOrderAccepted(payload: { orderId: string; deliveryPartnerId: string }) {
    await this.pushAssignedOrders(payload.deliveryPartnerId);
  }

  @OnEvent('order.completed')
  async handleOrderCompleted(payload: { orderId: string; dpId: string }) {
    await this.pushAssignedOrders(payload.dpId);
  }

  closeStream(orderId: string) {
    const stream = this.streams.get(orderId);
    if (stream) {
      stream.complete();
      this.streams.delete(orderId);
    }
  }

  closeDpStream(dpId: string) {
    const stream = this.dpStreams.get(dpId);
    if (stream) {
      stream.complete();
      this.dpStreams.delete(dpId);
    }
  }
}
