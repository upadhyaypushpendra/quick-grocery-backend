import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartItem } from './entities/cart.entity';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private cartItemRepo: Repository<CartItem>,
  ) {}

  async getOrCreateCart(userId: string) {
    let cart = await this.cartRepo.findOne({
      where: { userId },
      relations: ['items'],
    });

    if (!cart) {
      cart = this.cartRepo.create({ userId });
      cart = await this.cartRepo.save(cart);
    }

    return cart;
  }

  async getCart(userId: string) {
    return this.cartRepo.findOne({
      where: { userId },
      relations: ['items'],
    });
  }

  async addItem(userId: string, dto: AddToCartDto, productData: any) {
    const cart = await this.getOrCreateCart(userId);

    // Check if product already in cart
    let cartItem = await this.cartItemRepo.findOne({
      where: {
        cartId: cart.id,
        productId: dto.productId,
      },
    });

    if (cartItem) {
      cartItem.quantity += dto.quantity;
    } else {
      cartItem = this.cartItemRepo.create({
        cartId: cart.id,
        productId: dto.productId,
        quantity: dto.quantity,
        priceSnapshot: productData.price,
        productName: productData.name,
        imageUrl: productData.imageUrl,
      });
    }

    return this.cartItemRepo.save(cartItem);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.cartItemRepo.delete({
      cartId: cart.id,
      productId,
    });
  }

  async updateItemQuantity(
    userId: string,
    productId: string,
    quantity: number,
  ) {
    const cart = await this.getOrCreateCart(userId);
    if (quantity <= 0) {
      await this.removeItem(userId, productId);
      return null;
    }

    const cartItem = await this.cartItemRepo.findOne({
      where: {
        cartId: cart.id,
        productId,
      },
    });

    if (cartItem) {
      cartItem.quantity = quantity;
      return this.cartItemRepo.save(cartItem);
    }

    return null;
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.cartItemRepo.delete({ cartId: cart.id });
  }

  async getCartTotal(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    const items = await this.cartItemRepo.find({
      where: { cartId: cart.id },
    });

    return items.reduce((sum, item) => sum + Number(item.priceSnapshot) * item.quantity, 0);
  }
}
