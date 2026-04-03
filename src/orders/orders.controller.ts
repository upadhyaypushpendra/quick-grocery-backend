import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Logger,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Sse,
  Req,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Observable, concat, of } from 'rxjs';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtSseGuard } from '../auth/guards/jwt-sse.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './entities/order.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private ordersService: OrdersService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  // ── Customer endpoints ────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  async createOrder(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  async getOrders(@CurrentUser() user: any) {
    return this.ordersService.getOrders(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  async getOrder(@CurrentUser() user: any, @Param('id') orderId: string) {
    const order = await this.ordersService.getOrderById(orderId, user.id);
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    return order;
  }

  // ── Delivery partner endpoints ────────────────────────────────────────────

  @Get('assigned/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('delivery_partner')
  async getAssignedOrders(@CurrentUser() user: any) {
    return this.ordersService.getAssignedOrders(user.id);
  }

  @Get('assigned/stream')
  @Sse()
  @UseGuards(JwtSseGuard, RolesGuard)
  @Roles('delivery_partner')
  async assignedOrdersStream(
    @CurrentUser() user: any,
    @Req() req: { on: (event: string, cb: () => void) => void },
  ): Promise<Observable<MessageEvent>> {
    const dpId: string = user.id;
    this.logger.log(`SSE connected: assigned/stream dpId=${dpId}`);
    const stream = this.notificationsService.getDpStream(dpId);
    const orders = await this.ordersService.getAssignedOrders(dpId);

    req.on('close', () => {
      this.logger.log(`SSE disconnected: assigned/stream dpId=${dpId}`);
      this.notificationsService.closeDpStream(dpId);
    });

    return concat(
      of({ data: JSON.stringify({ type: 'orders', orders }) } as MessageEvent),
      stream.asObservable(),
    );
  }

  @Get('assigned/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('delivery_partner')
  async getAssignedOrder(
    @CurrentUser() user: any,
    @Param('id') orderId: string,
  ) {
    const order = await this.ordersService.getAssignedOrderById(orderId, user.id);
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    return order;
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('delivery_partner')
  async updateStatus(
    @CurrentUser() user: any,
    @Param('id') orderId: string,
    @Body() { status }: { status: OrderStatus },
  ) {
    if (!Object.values(OrderStatus).includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    return this.ordersService.updateOrderStatus(orderId, user.id, status);
  }

  @Post(':id/delivered')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('delivery_partner')
  async markDelivered(@CurrentUser() user: any, @Param('id') orderId: string) {
    return this.ordersService.markDelivered(orderId, user.id);
  }

  // ── Admin endpoints ───────────────────────────────────────────────────────

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminOrderStats() {
    return this.ordersService.adminGetOrderStats();
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminListOrders(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.ordersService.adminGetAllOrders({
      page: parseInt(page),
      limit: parseInt(limit),
      status: status as OrderStatus | undefined,
    });
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminGetOrder(@Param('id') orderId: string) {
    return this.ordersService.adminGetOrderById(orderId);
  }

  @Delete('admin/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminCancelOrder(@Param('id') orderId: string) {
    return this.ordersService.adminCancelOrder(orderId);
  }
}
