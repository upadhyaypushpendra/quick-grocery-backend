import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PushService } from './push.service';
import { RegisterPushDto } from './dto/register-push.dto';

@Controller('notifications')
export class PushController {
  constructor(private pushService: PushService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: this.pushService.getVapidPublicKey() };
  }

  @Post('push/subscribe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'delivery_partner')
  subscribe(@CurrentUser() user: any, @Body() dto: RegisterPushDto) {
    return this.pushService.subscribe(user.id, dto);
  }

  @Post('push/unsubscribe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'delivery_partner')
  async unsubscribe(
    @CurrentUser() user: any,
    @Body('endpoint') endpoint: string,
  ) {
    await this.pushService.unsubscribe(user.id, endpoint);
    return { success: true };
  }
}
