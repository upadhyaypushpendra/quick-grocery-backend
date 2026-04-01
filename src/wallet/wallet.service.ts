import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  private toMoneyNumber(value: unknown): number {
    const parsed =
      typeof value === 'number' ? value : Number.parseFloat(String(value));

    if (!Number.isFinite(parsed)) {
      throw new BadRequestException('Invalid amount');
    }

    return parsed;
  }

  private roundMoney(value: number): number {
    return Number.parseFloat(value.toFixed(2));
  }

  /**
   * Get or create wallet for user
   */
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepo.findOne({ where: { userId } });

    if (!wallet) {
      wallet = this.walletRepo.create({
        userId,
        balance: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
        totalWithdrawn: 0,
      });
      await this.walletRepo.save(wallet);
    }

    return wallet;
  }

  /**
   * Get wallet details
   */
  async getWallet(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  /**
   * Add earnings to pending (when order is completed)
   */
  async addPendingEarnings(userId: string, amount: number): Promise<Wallet> {
    const normalizedAmount = this.toMoneyNumber(amount);

    if (normalizedAmount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(userId);
    const currentPending = this.toMoneyNumber(wallet.pendingEarnings);
    const currentTotalEarnings = this.toMoneyNumber(wallet.totalEarnings);

    wallet.pendingEarnings = this.roundMoney(currentPending + normalizedAmount);
    wallet.totalEarnings = this.roundMoney(
      currentTotalEarnings + normalizedAmount,
    );

    return this.walletRepo.save(wallet);
  }

  /**
   * Move pending earnings to balance (when withdrawal is approved)
   */
  async approvePendingEarnings(
    userId: string,
    amount: number,
  ): Promise<Wallet> {
    const normalizedAmount = this.toMoneyNumber(amount);

    if (normalizedAmount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(userId);
    const currentPending = this.toMoneyNumber(wallet.pendingEarnings);
    const currentBalance = this.toMoneyNumber(wallet.balance);

    if (currentPending < normalizedAmount) {
      throw new BadRequestException('Insufficient pending earnings');
    }

    wallet.pendingEarnings = this.roundMoney(currentPending - normalizedAmount);
    wallet.balance = this.roundMoney(currentBalance + normalizedAmount);

    return this.walletRepo.save(wallet);
  }

  /**
   * Withdraw from wallet
   */
  async withdraw(userId: string, amount: number): Promise<Wallet> {
    const normalizedAmount = this.toMoneyNumber(amount);

    if (normalizedAmount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(userId);
    const currentBalance = this.toMoneyNumber(wallet.balance);
    const currentTotalWithdrawn = this.toMoneyNumber(wallet.totalWithdrawn);

    if (currentBalance < normalizedAmount) {
      throw new BadRequestException('Insufficient balance');
    }

    wallet.balance = this.roundMoney(currentBalance - normalizedAmount);
    wallet.totalWithdrawn = this.roundMoney(
      currentTotalWithdrawn + normalizedAmount,
    );

    return this.walletRepo.save(wallet);
  }

  /**
   * Confirm pending earnings (move to balance when order is delivered)
   * Same as approvePendingEarnings but with clearer naming for delivery flow
   */
  async confirmPendingEarnings(
    userId: string,
    amount: number,
  ): Promise<Wallet> {
    return this.approvePendingEarnings(userId, amount);
  }

  /**
   * Get wallet summary for user profile
   */
  async getWalletSummary(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const user = await this.userRepo.findOne({ where: { id: userId } });

    return {
      balance: wallet.balance,
      totalEarnings: wallet.totalEarnings,
      pendingEarnings: wallet.pendingEarnings,
      totalWithdrawn: wallet.totalWithdrawn,
      user: {
        id: user?.id,
        firstName: user?.firstName,
        lastName: user?.lastName,
        identifier: user?.identifier,
        role: user?.role,
      },
    };
  }
}
