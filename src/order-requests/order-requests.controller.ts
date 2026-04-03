import {
  Controller,
  Get,
  Logger,
  Post,
  Param,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { OrderRequestService } from './order-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtSseGuard } from '../auth/guards/jwt-sse.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LocationService } from '../location/location.service';
import { Observable, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Controller('order-requests')
@Roles('delivery_partner')
export class OrderRequestController {
  private readonly logger = new Logger(OrderRequestController.name);

  constructor(
    private orderRequestService: OrderRequestService,
    private locationService: LocationService,
  ) {}

  @Sse('listen')
  @UseGuards(JwtSseGuard, RolesGuard)
  listenToOrderRequests(@CurrentUser() user: any): Observable<MessageEvent> {
    const deliveryPartnerId = user.id;

    return new Observable((subscriber) => {
      this.logger.log(`SSE connected: deliveryPartnerId=${deliveryPartnerId}`);
      void this.locationService.heartbeat(deliveryPartnerId);

      subscriber.next({
        data: JSON.stringify({
          type: 'connected',
          message: 'Connected to order request stream',
          timestamp: new Date().toISOString(),
        }),
      } as MessageEvent);

      const heartbeatSubscription = interval(15000).subscribe(() => {
        void this.locationService.heartbeat(deliveryPartnerId);
        subscriber.next({
          data: JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
          }),
        } as MessageEvent);
      });

      const subscription = interval(5000)
        .pipe(
          switchMap(async () => {
            try {
              const requests =
                await this.orderRequestService.getPendingRequests(
                  deliveryPartnerId,
                );

              return {
                type: 'order_request',
                data: requests.map((req) => ({
                  id: req.id,
                  orderId: req.orderId,
                  deliveryFee: req.deliveryFee,
                  pickupLatitude: req.pickupLatitude,
                  pickupLongitude: req.pickupLongitude,
                  deliveryLatitude: req.deliveryLatitude,
                  deliveryLongitude: req.deliveryLongitude,
                  expiresAt: req.expiresAt,
                  createdAt: req.createdAt,
                })),
                timestamp: new Date().toISOString(),
              };
            } catch (error) {
              this.logger.error(
                `Error fetching pending requests for deliveryPartnerId=${deliveryPartnerId}`,
                error,
              );
              return {
                type: 'error',
                message: 'Failed to fetch orders',
                timestamp: new Date().toISOString(),
              };
            }
          }),
        )
        .subscribe((message) => {
          subscriber.next({ data: JSON.stringify(message) } as MessageEvent);
        });

      return () => {
        this.logger.log(
          `SSE disconnected: deliveryPartnerId=${deliveryPartnerId}`,
        );
        subscription.unsubscribe();
        heartbeatSubscription.unsubscribe();
        void this.locationService.stopTracking(deliveryPartnerId);
      };
    });
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getPendingRequests(@CurrentUser() user: any) {
    const requests = await this.orderRequestService.getPendingRequests(user.id);
    return {
      count: requests.length,
      requests: requests.map((req) => ({
        id: req.id,
        orderId: req.orderId,
        deliveryFee: req.deliveryFee,
        pickupLatitude: req.pickupLatitude,
        pickupLongitude: req.pickupLongitude,
        deliveryLatitude: req.deliveryLatitude,
        deliveryLongitude: req.deliveryLongitude,
        expiresAt: req.expiresAt,
        createdAt: req.createdAt,
      })),
    };
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async acceptOrderRequest(
    @Param('id') orderRequestId: string,
    @CurrentUser() user: any,
  ) {
    const orderRequest = await this.orderRequestService.acceptOrderRequest(
      orderRequestId,
      user.id,
    );
    return {
      message: 'Order request accepted',
      orderId: orderRequest.orderId,
      deliveryFee: orderRequest.deliveryFee,
    };
  }

  @Post(':id/decline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async declineOrderRequest(
    @Param('id') orderRequestId: string,
    @CurrentUser() user: any,
  ) {
    await this.orderRequestService.declineOrderRequest(orderRequestId, user.id);
    return {
      message: 'Order request declined',
    };
  }
}
