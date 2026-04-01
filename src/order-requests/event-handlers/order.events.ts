import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderRequestService } from '../order-requests.service';

/**
 * Event handlers for order-related events
 */
@Injectable()
export class OrderEventHandlers {
  constructor(private orderRequestService: OrderRequestService) {}

  /**
   * Listen for order.request_created event and create OrderRequests
   */
  @OnEvent('order.request_created')
  async handleOrderRequestCreated(payload: {
    orderId: string;
    deliveryPartnerIds: string[];
    deliveryFee: number;
    pickupLatitude: number;
    pickupLongitude: number;
    deliveryLatitude: number;
    deliveryLongitude: number;
    expiresAt: Date;
  }) {
    // Create OrderRequest for each nearby delivery partner
    for (const dpId of payload.deliveryPartnerIds) {
      await this.orderRequestService.createOrderRequest({
        orderId: payload.orderId,
        deliveryPartnerId: dpId,
        deliveryFee: payload.deliveryFee,
        pickupLatitude: payload.pickupLatitude,
        pickupLongitude: payload.pickupLongitude,
        deliveryLatitude: payload.deliveryLatitude,
        deliveryLongitude: payload.deliveryLongitude,
        expiresAt: payload.expiresAt,
      });
    }

    this.orderRequestService.scheduleOrderRequestExpiry(
      payload.orderId,
      payload.expiresAt,
    );
  }
}
