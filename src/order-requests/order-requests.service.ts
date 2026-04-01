import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Not, Repository } from 'typeorm';
import {
  Order,
  OrderStatus,
  OrderStatusEvent,
} from '../orders/entities/order.entity';
import { WalletService } from '../wallet/wallet.service';
import {
  OrderRequest,
  OrderRequestStatus,
} from './entities/order-request.entity';

export interface CreateOrderRequestDto {
  orderId: string;
  deliveryPartnerId: string;
  deliveryFee: number;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  expiresAt?: Date;
}

@Injectable()
export class OrderRequestService {
  private expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(OrderRequest)
    private orderRequestRepo: Repository<OrderRequest>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(OrderStatusEvent)
    private orderStatusEventRepo: Repository<OrderStatusEvent>,
    private walletService: WalletService,
    private eventEmitter: EventEmitter2,
  ) {}

  private clearExpiryTimer(orderId: string): void {
    const timer = this.expiryTimers.get(orderId);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(orderId);
    }
  }

  scheduleOrderRequestExpiry(orderId: string, expiresAt: Date): void {
    this.clearExpiryTimer(orderId);

    const delay = Math.max(expiresAt.getTime() - Date.now(), 0);
    const timer = setTimeout(() => {
      void this.expirePendingRequestsForOrder(orderId);
    }, delay);

    this.expiryTimers.set(orderId, timer);
  }

  private async cancelOrderIfUnassigned(orderId: string): Promise<void> {
    const acceptedRequest = await this.orderRequestRepo.findOne({
      where: { orderId, status: OrderRequestStatus.ACCEPTED },
    });

    if (acceptedRequest) {
      this.clearExpiryTimer(orderId);
      return;
    }

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order || order.status !== OrderStatus.PENDING) {
      this.clearExpiryTimer(orderId);
      return;
    }

    order.status = OrderStatus.CANCELLED;
    await this.orderRepo.save(order);

    await this.orderStatusEventRepo.save({
      orderId,
      status: OrderStatus.CANCELLED,
      note: 'No delivery partner available',
    });

    this.eventEmitter.emit('order.status_updated', {
      orderId,
      status: OrderStatus.CANCELLED,
      timestamp: new Date(),
    });

    this.clearExpiryTimer(orderId);
  }

  private async expirePendingRequestsForOrder(orderId: string): Promise<void> {
    const now = new Date();
    const expiredRequests = await this.orderRequestRepo.find({
      where: {
        orderId,
        status: OrderRequestStatus.PENDING,
        expiresAt: LessThanOrEqual(now),
      },
    });

    if (expiredRequests.length > 0) {
      await this.orderRequestRepo.update(
        { id: In(expiredRequests.map((request) => request.id)) },
        { status: OrderRequestStatus.EXPIRED },
      );
    }

    await this.cancelOrderIfUnassigned(orderId);
  }

  private async expireStalePendingRequests(): Promise<void> {
    const now = new Date();
    const expiredRequests = await this.orderRequestRepo.find({
      where: {
        status: OrderRequestStatus.PENDING,
        expiresAt: LessThanOrEqual(now),
      },
    });

    if (expiredRequests.length === 0) {
      return;
    }

    await this.orderRequestRepo.update(
      { id: In(expiredRequests.map((request) => request.id)) },
      { status: OrderRequestStatus.EXPIRED },
    );

    for (const orderId of new Set(
      expiredRequests.map((request) => request.orderId),
    )) {
      await this.cancelOrderIfUnassigned(orderId);
    }
  }

  /**
   * Create order request for delivery partner
   */
  async createOrderRequest(dto: CreateOrderRequestDto): Promise<OrderRequest> {
    const orderRequest = this.orderRequestRepo.create({
      orderId: dto.orderId,
      deliveryPartnerId: dto.deliveryPartnerId,
      deliveryFee: dto.deliveryFee,
      pickupLatitude: dto.pickupLatitude,
      pickupLongitude: dto.pickupLongitude,
      deliveryLatitude: dto.deliveryLatitude,
      deliveryLongitude: dto.deliveryLongitude,
      status: OrderRequestStatus.PENDING,
      expiresAt: dto.expiresAt || new Date(Date.now() + 2 * 60 * 1000),
    });

    return this.orderRequestRepo.save(orderRequest);
  }

  async getPendingRequests(deliveryPartnerId: string): Promise<OrderRequest[]> {
    await this.expireStalePendingRequests();

    return this.orderRequestRepo.find({
      where: {
        deliveryPartnerId,
        status: OrderRequestStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Accept order request - marks request as accepted, updates order, and adds pending earnings
   */
  async acceptOrderRequest(
    orderRequestId: string,
    deliveryPartnerId: string,
  ): Promise<OrderRequest> {
    await this.expireStalePendingRequests();

    const orderRequest = await this.orderRequestRepo.findOne({
      where: { id: orderRequestId },
    });

    if (!orderRequest) {
      throw new NotFoundException('Order request not found');
    }

    if (orderRequest.deliveryPartnerId !== deliveryPartnerId) {
      throw new BadRequestException('Not authorized to accept this order');
    }

    if (orderRequest.status !== OrderRequestStatus.PENDING) {
      throw new BadRequestException('Order request is no longer available');
    }

    if (orderRequest.expiresAt && new Date() > orderRequest.expiresAt) {
      await this.expirePendingRequestsForOrder(orderRequest.orderId);
      throw new BadRequestException('Order request has expired');
    }

    // Mark this request as accepted
    orderRequest.status = OrderRequestStatus.ACCEPTED;
    await this.orderRequestRepo.save(orderRequest);
    this.clearExpiryTimer(orderRequest.orderId);

    // Decline all other requests for this order
    await this.orderRequestRepo.update(
      { orderId: orderRequest.orderId, id: Not(orderRequestId) },
      { status: OrderRequestStatus.DECLINED },
    );

    // Update order: set delivery partner and status
    const order = await this.orderRepo.findOne({
      where: { id: orderRequest.orderId },
    });

    if (order) {
      order.deliveryPartnerId = deliveryPartnerId;
      order.status = OrderStatus.ACCEPTED;
      await this.orderRepo.save(order);

      // Persist status history event so frontend tracking reflects accepted state
      await this.orderStatusEventRepo.save({
        orderId: order.id,
        status: OrderStatus.ACCEPTED,
        note: 'Order accepted by delivery partner',
      });

      // Add pending earnings to DP wallet
      await this.walletService.addPendingEarnings(
        deliveryPartnerId,
        orderRequest.deliveryFee,
      );

      // Notify both customer and DP via SSE
      this.eventEmitter.emit('order.status_updated', {
        orderId: order.id,
        status: OrderStatus.ACCEPTED,
        timestamp: new Date(),
      });

      this.eventEmitter.emit('order.accepted', {
        orderId: order.id,
        deliveryPartnerId,
        deliveryFee: orderRequest.deliveryFee,
      });
    }

    return orderRequest;
  }

  async declineOrderRequest(
    orderRequestId: string,
    deliveryPartnerId: string,
  ): Promise<void> {
    await this.expireStalePendingRequests();

    const orderRequest = await this.orderRequestRepo.findOne({
      where: { id: orderRequestId },
    });

    if (!orderRequest) {
      throw new NotFoundException('Order request not found');
    }

    if (orderRequest.deliveryPartnerId !== deliveryPartnerId) {
      throw new BadRequestException('Not authorized to decline this order');
    }

    orderRequest.status = OrderRequestStatus.DECLINED;
    await this.orderRequestRepo.save(orderRequest);
  }
}
