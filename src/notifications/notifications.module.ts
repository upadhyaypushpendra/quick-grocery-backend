import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { PushSubscription } from './entities/push-subscription.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscription, Order]),
    forwardRef(() => OrdersModule),
    AuthModule,
  ],
  providers: [NotificationsService, PushService],
  controllers: [NotificationsController, PushController],
  exports: [PushService, NotificationsService],
})
export class NotificationsModule {}

