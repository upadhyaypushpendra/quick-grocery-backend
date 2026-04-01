import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  comparePrice: number;

  @Prop()
  imageUrl: string;

  @Prop([String])
  images: string[];

  @Prop({ required: true })
  categoryId: string;

  @Prop([String])
  tags: string[];

  @Prop({ default: true })
  inStock: boolean;

  @Prop({ default: 0 })
  stockQty: number;

  @Prop()
  unit: string; // e.g. "500g", "1L", "each"

  @Prop()
  brand: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
// Enhanced text search index - prioritizes name > tags > description
ProductSchema.index({ name: 'text', tags: 'text', brand: 'text', description: 'text' }, { weights: { name: 10, tags: 5, brand: 8, description: 1 } });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ slug: 1 });
ProductSchema.index({ inStock: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ tags: 1 });
