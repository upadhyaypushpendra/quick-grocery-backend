import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { ProductsService } from '../products/products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user')
export class CartController {
  constructor(
    private cartService: CartService,
    private productsService: ProductsService,
  ) {}

  @Get()
  async getCart(@CurrentUser() user: any) {
    return this.cartService.getCart(user.id);
  }

  @Post('items')
  async addItem(@CurrentUser() user: any, @Body() dto: AddToCartDto) {
    const product = await this.productsService.findBySlug(dto.productId);
    if (!product) {
      throw new BadRequestException('Product not found');
    }

    if (!product.inStock || product.stockQty < dto.quantity) {
      throw new BadRequestException('Product not in stock');
    }

    return this.cartService.addItem(user.id, dto, product);
  }

  @Patch('items/:productId')
  async updateItem(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
    @Body() { quantity }: { quantity: number },
  ) {
    return this.cartService.updateItemQuantity(user.id, productId, quantity);
  }

  @Delete('items/:productId')
  async removeItem(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
  ) {
    await this.cartService.removeItem(user.id, productId);
    return { message: 'Item removed' };
  }

  @Delete()
  async clearCart(@CurrentUser() user: any) {
    await this.cartService.clearCart(user.id);
    return { message: 'Cart cleared' };
  }
}
