import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { Product, ProductSchema } from './schemas/product.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.get('redis.host'),
            port: configService.get('redis.port'),
          },
          username: configService.get('redis.username'),
          password: configService.get('redis.password'),
        }),
      }),
    }),
    AuthModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    TypeOrmModule.forFeature([Order, OrderItem]),
  ],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
