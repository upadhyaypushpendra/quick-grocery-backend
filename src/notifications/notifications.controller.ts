import {
  Controller,
  Get,
  Param,
  UseGuards,
  Sse,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { OrdersService } from '../orders/orders.service';
import { JwtSseGuard } from '../auth/guards/jwt-sse.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('orders')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private ordersService: OrdersService,
  ) {}

  @Get(':id/events')
  @Sse()
  @UseGuards(JwtSseGuard, RolesGuard)
  @Roles('user', 'delivery_partner')
  async orderEvents(
    @Param('id') orderId: string,
    @CurrentUser() user: any,
  ): Promise<Observable<MessageEvent>> {
    const order = await this.ordersService.getOrderForParticipant(
      orderId,
      user.id,
    );
    if (!order) {
      throw new BadRequestException('Order not found');
    }

    const stream = this.notificationsService.getStream(orderId);

    for (const event of order.statusHistory) {
      stream.next({
        data: JSON.stringify({
          orderId,
          status: event.status,
          timestamp: event.timestamp,
          note: event.note,
        }),
      } as any);
    }

    return stream.asObservable();
  }
}
