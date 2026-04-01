import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderRequestController } from './order-requests.controller';
import { OrderRequestService } from './order-requests.service';
import { OrderEventHandlers } from './event-handlers/order.events';
import { OrderRequest } from './entities/order-request.entity';
import { Order, OrderStatusEvent } from '../orders/entities/order.entity';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';
import { LocationModule } from '../location/location.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderRequest, Order, OrderStatusEvent]),
    WalletModule,
    AuthModule,
    LocationModule,
  ],
  controllers: [OrderRequestController],
  providers: [OrderRequestService, OrderEventHandlers],
  exports: [OrderRequestService],
})
export class OrderRequestsModule {}
