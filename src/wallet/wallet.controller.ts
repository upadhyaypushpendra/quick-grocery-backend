import { Controller, Get, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('delivery_partner')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get()
  async getWallet(@CurrentUser() user: any) {
    return this.walletService.getWalletSummary(user.id);
  }

  @Get('balance')
  async getBalance(@CurrentUser() user: any) {
    const wallet = await this.walletService.getOrCreateWallet(user.id);
    return {
      balance: wallet.balance,
      totalEarnings: wallet.totalEarnings,
      pendingEarnings: wallet.pendingEarnings,
    };
  }
}
