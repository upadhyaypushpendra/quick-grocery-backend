import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Category, CategoryDocument } from './schemas/category.schema';
import { QueryProductsDto } from './dto/query-products.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { type Cache } from 'cache-manager';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemRepo: Repository<OrderItem>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll(query: QueryProductsDto) {
    const { page = 1, limit = 20, categoryId, search, sort, inStock } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (categoryId) {
      // Support comma-separated list of IDs (used when querying parent + children)
      const ids = categoryId
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      filter.categoryId = ids.length === 1 ? ids[0] : { $in: ids };
    }
    if (inStock !== undefined) {
      // Convert string "true"/"false" to boolean
      filter.inStock = inStock;
    }

    const sortObj: any = {};
    let pipeline: any[] = [];

    if (search) {
      // Use regex for partial matching on name, tags, brand, description
      pipeline = [
        {
          $match: {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { brand: { $regex: search, $options: 'i' } },
              { tags: { $regex: search, $options: 'i' } },
              { description: { $regex: search, $options: 'i' } },
            ],
            ...filter,
          },
        },
        // Score results: name matches highest, then brand, then tags/description
        {
          $addFields: {
            score: {
              $add: [
                {
                  $cond: [
                    {
                      $regexMatch: {
                        input: '$name',
                        regex: search,
                        options: 'i',
                      },
                    },
                    10,
                    0,
                  ],
                },
                {
                  $cond: [
                    {
                      $regexMatch: {
                        input: '$brand',
                        regex: search,
                        options: 'i',
                      },
                    },
                    5,
                    0,
                  ],
                },
                { $cond: [{ $in: [search, '$tags'] }, 3, 0] },
              ],
            },
          },
        },
        {
          $sort: { score: -1 },
        },
      ];
    } else {
      // Regular find without text search
      if (sort === 'price_asc') sortObj.price = 1;
      else if (sort === 'price_desc') sortObj.price = -1;
      else if (sort === 'newest') sortObj.createdAt = -1;

      pipeline = [
        { $match: filter },
        ...(Object.keys(sortObj).length > 0 ? [{ $sort: sortObj }] : []),
      ];
    }

    // Add pagination to pipeline
    pipeline.push({
      $facet: {
        total: [{ $count: 'count' }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    });

    // console.log(JSON.stringify(pipeline));

    const result = await this.productModel.aggregate(pipeline);

    // console.log('Aggregation result:', JSON.stringify(result));

    const { total, data } = result[0];
    const totalCount = total.length > 0 ? total[0].count : 0;

    return {
      data,
      total: totalCount,
      page,
      limit,
      pages: Math.ceil(totalCount / limit),
    };
  }

  async findBySlug(slug: string) {
    return this.productModel.findOne({ slug }).lean();
  }

  async findByCategorySlug(categorySlug: string, query: QueryProductsDto) {
    const category = await this.categoryModel
      .findOne({ slug: categorySlug })
      .lean();
    if (!category) {
      throw new Error('Category not found');
    }

    // Collect this category + all direct children so products of subcategories
    // are included when browsing a parent category.
    const categoryId = category._id.toString();
    const children = await this.categoryModel
      .find({ parentId: categoryId })
      .select('_id')
      .lean();
    const ids = [categoryId, ...children.map((c) => c._id.toString())];

    return this.findAll({
      ...query,
      categoryId: ids.join(','),
    });
  }

  async findCategories() {
    return this.categoryModel.find().sort({ sortOrder: 1 }).lean();
  }

  async findTopLevelCategories() {
    return this.categoryModel
      .find({ $or: [{ parentId: null }, { parentId: { $exists: false } }] })
      .sort({ sortOrder: 1 })
      .lean();
  }

  async findSubcategories(parentId: string) {
    return await this.categoryModel
      .find({ parentId })
      .sort({ sortOrder: 1 })
      .lean();
  }

  async findSubcategoriesByParentId(parentId: string) {
    const parent = await this.categoryModel.findOne({ _id: parentId }).lean();

    if (!parent) return [];

    return this.categoryModel
      .find({ parentId: parent._id.toString() })
      .sort({ sortOrder: 1 })
      .lean();
  }

  async findCategoryBySlug(slug: string) {
    return this.categoryModel.findOne({ slug }).lean();
  }

  async getTopProducts(limit = 12) {
    const cached = await this.cacheManager.get<Product[]>('top_products');

    if (cached) return cached;

    // Get most frequently ordered products
    const topProducts = await this.orderItemRepo
      .createQueryBuilder('oi')
      .select('oi.productId')
      .addSelect('COUNT(oi.id)', 'orderCount')
      .groupBy('oi.productId')
      .orderBy('COUNT(oi.id)', 'DESC')
      .limit(limit)
      .getRawMany();

    const productIds = topProducts.map((p) => p.oi_productId);
    const products = await this.productModel
      .find({ slug: { $in: productIds }, inStock: true })
      .lean()
      .limit(limit);

    // Cache for 1 hour
    await this.cacheManager.set('top_products', products, 3600000);
    return products;
  }

  async getFrequentProductsByUser(userId: string, limit = 12) {
    // Get user's completed orders
    const orders = await this.orderRepo.find({
      where: { userId, completed: true },
      relations: ['items'],
    });

    // Count product frequency
    const productFreq: { [key: string]: number } = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        productFreq[item.productId] =
          (productFreq[item.productId] || 0) + item.quantity;
      });
    });

    // Get top products by frequency
    const sortedProducts = Object.entries(productFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId]) => productId);

    if (sortedProducts.length === 0) {
      // If user has no orders, return top products
      return this.getTopProducts(limit);
    }

    const products = await this.productModel
      .find({ slug: { $in: sortedProducts }, inStock: true })
      .lean();

    return products;
  }

  // ── Admin: Category CRUD ──────────────────────────────────────────────────

  async findAllCategoriesGrouped() {
    const all = await this.categoryModel.find().sort({ sortOrder: 1 }).lean();
    const parents = all.filter((c) => !c.parentId);
    return parents.map((parent) => ({
      ...parent,
      children: all.filter((c) => c.parentId === parent._id.toString()),
    }));
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = dto.slug || this.slugify(dto.name);
    const category = new this.categoryModel({ ...dto, slug });
    return category.save();
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const updated = await this.categoryModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Category not found');
    return updated;
  }

  async deleteCategory(id: string) {
    const productCount = await this.productModel.countDocuments({
      categoryId: id,
    });
    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete: ${productCount} product(s) reference this category`,
      );
    }
    const subCount = await this.categoryModel.countDocuments({ parentId: id });
    if (subCount > 0) {
      throw new BadRequestException(
        `Cannot delete: ${subCount} subcategory(ies) reference this category`,
      );
    }
    const deleted = await this.categoryModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Category not found');
    return { deleted: true };
  }

  // ── Admin: Product CRUD ───────────────────────────────────────────────────

  async findAllAdmin(query: QueryProductsDto) {
    // Same as findAll but does NOT filter by inStock by default
    return this.findAll(query);
  }

  async findProductById(id: string) {
    const product = await this.productModel.findById(id).lean();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createProduct(dto: CreateProductDto) {
    const slug = dto.slug || this.slugify(dto.name);
    const product = new this.productModel({ ...dto, slug });
    return product.save();
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const updated = await this.productModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Product not found');
    return updated;
  }

  async deleteProduct(id: string) {
    const deleted = await this.productModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Product not found');
    return { deleted: true };
  }

  async getDashboardStats() {
    const [totalProducts, totalCategories, inStockCount] = await Promise.all([
      this.productModel.countDocuments(),
      this.categoryModel.countDocuments(),
      this.productModel.countDocuments({ inStock: true }),
    ]);
    return {
      totalProducts,
      totalCategories,
      inStockCount,
      outOfStockCount: totalProducts - inStockCount,
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
