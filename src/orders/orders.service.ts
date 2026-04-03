import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusEvent,
} from './entities/order.entity';
import { Address } from '../users/entities/address.entity';
import { Location } from '../location/entities/location.entity';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import { WalletService } from '../wallet/wallet.service';
import { User } from '../users/entities/user.entity';
import { OnEvent } from '@nestjs/event-emitter';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private static readonly DELIVERY_PARTNER_ACTIVE_WINDOW_MS = 30_000;

  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemRepo: Repository<OrderItem>,
    @InjectRepository(OrderStatusEvent)
    private eventRepo: Repository<OrderStatusEvent>,
    @InjectRepository(Address) private addressRepo: Repository<Address>,
    @InjectRepository(Location) private locationRepo: Repository<Location>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private cartService: CartService,
    private productsService: ProductsService,
    private walletService: WalletService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Calculate distance between two coordinates (km)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Find nearby delivery partners (top 3 closest and active)
   */
  private async findNearbyDeliveryPartners(
    deliveryLatitude: number,
    deliveryLongitude: number,
  ): Promise<User[]> {
    const activeThreshold = new Date(
      Date.now() - OrdersService.DELIVERY_PARTNER_ACTIVE_WINDOW_MS,
    );

    const activeLocations = await this.locationRepo.find({
      where: {
        isTracking: true,
        updatedAt: MoreThan(activeThreshold),
      },
      relations: ['user'],
    });

    if (!activeLocations || activeLocations.length === 0) {
      return [];
    }

    const withDistance = activeLocations.map((loc) => ({
      user: loc.user,
      distance: this.calculateDistance(
        Number(loc.latitude),
        Number(loc.longitude),
        deliveryLatitude,
        deliveryLongitude,
      ),
    }));

    return withDistance
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((item) => item.user);
  }

  private static readonly REACHED_RADIUS_KM = 0.05; // 50 meters

  /**
   * Auto-update order to REACHED when DP is within 50m of delivery location
   */
  @OnEvent('dp.location_updated')
  async handleDpLocationUpdated(payload: {
    userId: string;
    latitude: number;
    longitude: number;
  }) {
    const activeOrder = await this.orderRepo.findOne({
      where: {
        deliveryPartnerId: payload.userId,
        status: OrderStatus.OUT_FOR_DELIVERY,
        completed: false,
      },
    });

    if (!activeOrder) return;

    const distance = this.calculateDistance(
      payload.latitude,
      payload.longitude,
      Number(activeOrder.deliveryLatitude),
      Number(activeOrder.deliveryLongitude),
    );

    if (distance <= OrdersService.REACHED_RADIUS_KM) {
      await this.updateOrderStatus(
        activeOrder.id,
        payload.userId,
        OrderStatus.REACHED,
      );
    }
  }

  async createOrder(userId: string, dto: CreateOrderDto) {
    const address = await this.addressRepo.findOne({
      where: { id: dto.addressId, userId },
    });

    if (!address) {
      throw new BadRequestException('Address not found');
    }

    const cart = await this.cartService.getCart(userId);
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Rebuild order items with fresh product data
    const orderItems: any[] = [];
    let totalAmount = 0;

    for (const item of cart.items) {
      const product = await this.productsService.findBySlug(item.productId);
      if (!product || !product.inStock || product.stockQty < item.quantity) {
        throw new BadRequestException(
          `Product ${item.productName} is no longer available`,
        );
      }

      orderItems.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: product.price,
      });

      totalAmount += product.price * item.quantity;
    }

    const deliveryFee = 50; // Fixed for now, can be dynamic

    // Check if delivery partners are available
    const nearbyDPs = await this.findNearbyDeliveryPartners(
      Number(address.latitude),
      Number(address.longitude),
    );

    if (!nearbyDPs || nearbyDPs.length === 0) {
      throw new BadRequestException(
        'No delivery partners available at the moment. Please try ordering after some time.',
      );
    }

    // Create order
    const order = this.orderRepo.create({
      userId,
      status: OrderStatus.PENDING,
      addressSnapshot: {
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        postcode: address.postcode,
      },
      deliveryLatitude: address.latitude,
      deliveryLongitude: address.longitude,
      totalAmount,
      deliveryFee,
    });

    const savedOrder = await this.orderRepo.save(order);

    // Create order items
    for (const item of orderItems) {
      await this.itemRepo.save({
        ...item,
        orderId: savedOrder.id,
      });
    }

    // Create initial status event
    await this.eventRepo.save({
      orderId: savedOrder.id,
      status: OrderStatus.PENDING,
      note: 'Order placed',
    });

    // Send order requests to nearby DPs via event
    if (nearbyDPs.length > 0) {
      this.eventEmitter.emit('order.request_created', {
        orderId: savedOrder.id,
        deliveryPartnerIds: nearbyDPs.map((dp) => dp.id),
        deliveryFee,
        pickupLatitude: 0, // Assume restaurant at origin for now
        pickupLongitude: 0,
        deliveryLatitude: address.latitude,
        deliveryLongitude: address.longitude,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      });
    }

    // Clear cart
    await this.cartService.clearCart(userId);

    // Emit event
    this.eventEmitter.emit('order.created', {
      orderId: savedOrder.id,
      userId,
      totalAmount,
    });

    return savedOrder;
  }

  async getOrders(userId: string) {
    return this.orderRepo.find({
      where: { userId },
      relations: ['items', 'statusHistory', 'deliveryPartner'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOrderById(orderId: string, userId: string) {
    return this.orderRepo.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'statusHistory', 'deliveryPartner'],
    });
  }

  async getAssignedOrders(deliveryPartnerId: string) {
    return this.orderRepo.find({
      where: { deliveryPartnerId },
      relations: ['items', 'statusHistory', 'deliveryPartner'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAssignedOrderById(orderId: string, deliveryPartnerId: string) {
    return this.orderRepo.findOne({
      where: { id: orderId, deliveryPartnerId },
      relations: ['items', 'statusHistory', 'deliveryPartner'],
    });
  }

  // ── Admin methods ──────────────────────────────────────────────────────────

  async adminGetAllOrders(params: {
    page: number;
    limit: number;
    status?: OrderStatus;
  }) {
    const { page, limit, status } = params;
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await this.orderRepo.findAndCount({
      where,
      relations: ['items', 'user', 'deliveryPartner'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async adminGetOrderById(orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'statusHistory', 'user', 'deliveryPartner'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async adminCancelOrder(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.completed) throw new BadRequestException('Order already completed');

    order.status = OrderStatus.CANCELLED;
    order.completed = true;
    await this.orderRepo.save(order);

    await this.eventRepo.save({
      orderId,
      status: OrderStatus.CANCELLED,
      note: 'Cancelled by admin',
    });

    this.eventEmitter.emit('order.status_updated', {
      orderId,
      status: OrderStatus.CANCELLED,
      timestamp: new Date(),
    });

    return order;
  }

  async adminGetOrderStats() {
    const statuses = Object.values(OrderStatus);
    const counts = await Promise.all(
      statuses.map((status) => this.orderRepo.count({ where: { status } })),
    );

    const byStatus = Object.fromEntries(
      statuses.map((status, i) => [status, counts[i]]),
    );

    const totalOrders = counts.reduce((a, b) => a + b, 0);
    const totalRevenue = await this.orderRepo
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.totalAmount), 0)', 'total')
      .where('order.status = :status', { status: OrderStatus.DELIVERED })
      .getRawOne()
      .then((r) => parseFloat(r.total));

    return { totalOrders, totalRevenue, byStatus };
  }

  async getOrderForParticipant(orderId: string, participantId: string) {
    return this.orderRepo.findOne({
      where: [
        { id: orderId, userId: participantId },
        { id: orderId, deliveryPartnerId: participantId },
      ],
      relations: ['items', 'statusHistory', 'deliveryPartner'],
    });
  }

  /**
   * Update order status by delivery partner
   */
  async updateOrderStatus(
    orderId: string,
    dpId: string,
    status: OrderStatus,
  ): Promise<OrderStatusEvent> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.deliveryPartnerId !== dpId) {
      throw new ForbiddenException('Not authorized to update this order');
    }

    if (order.completed) {
      throw new BadRequestException('Cannot update a completed order');
    }

    // Validate status progression
    const validTransitions = {
      [OrderStatus.ACCEPTED]: [OrderStatus.GOING_FOR_PICKUP],
      [OrderStatus.GOING_FOR_PICKUP]: [OrderStatus.OUT_FOR_DELIVERY],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.REACHED],
      [OrderStatus.REACHED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    };

    if (
      !validTransitions[order.status] ||
      !validTransitions[order.status].includes(status)
    ) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${status}`,
      );
    }

    order.status = status;
    if (status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED) {
      order.completed = true;
    }
    await this.orderRepo.save(order);

    // Create status event
    const event = await this.eventRepo.save({
      orderId,
      status,
      note: `Order status updated to ${status}`,
    });

    // Emit event for SSE
    this.eventEmitter.emit('order.status_updated', {
      orderId,
      status,
      timestamp: new Date(),
    });

    return event;
  }

  /**
   * Mark order as delivered (DP confirms delivery)
   */
  async markDelivered(orderId: string, dpId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.deliveryPartnerId !== dpId) {
      throw new ForbiddenException('Not authorized to deliver this order');
    }

    if (order.status !== OrderStatus.REACHED) {
      throw new BadRequestException(
        'Order must be in reached status to mark as delivered',
      );
    }

    // Update order status
    order.status = OrderStatus.DELIVERED;
    order.completed = true;
    await this.orderRepo.save(order);

    // Create status event
    await this.eventRepo.save({
      orderId,
      status: OrderStatus.DELIVERED,
      note: 'Order delivered by delivery partner',
    });

    // Move earnings from pending to confirmed
    await this.walletService.confirmPendingEarnings(dpId, order.deliveryFee);

    // Emit event for SSE
    this.eventEmitter.emit('order.status_updated', {
      orderId,
      status: OrderStatus.DELIVERED,
      timestamp: new Date(),
    });

    this.eventEmitter.emit('order.completed', {
      orderId,
      dpId,
      earnedAmount: order.deliveryFee,
    });

    return order;
  }
}
