import 'dotenv/config';
import { MongoClient } from 'mongodb';
import * as postgres from 'pg';
import { faker } from '@faker-js/faker';

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/groceries';
const DB_URL =
  process.env.DATABASE_URL || 'postgresql://L088617@localhost:5432/groceries';

const SUBCATEGORIES_PER_CATEGORY = 8;
const PRODUCTS_PER_SUBCATEGORY = 25;
const PRICE_MULTIPLIER = 10;

type TopCategory = {
  name: string;
  slug: string;
  imageUrl: string;
  sortOrder: number;
};

type Subcategory = {
  name: string;
  slug: string;
  parentSlug: string;
  imageUrl: string;
  sortOrder: number;
};

type ProductPool = {
  adjectives: string[];
  items: string[];
  brands: string[];
  units: string[];
  tags: string[];
};

type SeedProduct = {
  name: string;
  slug: string;
  price: number;
  comparePrice: number | null;
  unit: string;
  categorySlug: string;
  inStock: boolean;
  stockQty: number;
  tags: string[];
  brand: string;
  description: string;
};

const topLevelCategories: TopCategory[] = [
  {
    name: 'Fruits & Vegetables',
    slug: 'fruits-vegetables',
    imageUrl: '/categories/fruits.png',
    sortOrder: 1,
  },
  {
    name: 'Dairy & Eggs',
    slug: 'dairy-eggs',
    imageUrl: '/categories/dairy.png',
    sortOrder: 2,
  },
  {
    name: 'Bakery',
    slug: 'bakery',
    imageUrl: '/categories/bakery.png',
    sortOrder: 3,
  },
  {
    name: 'Beverages',
    slug: 'beverages',
    imageUrl: '/categories/drinks.png',
    sortOrder: 4,
  },
  {
    name: 'Snacks',
    slug: 'snacks',
    imageUrl: '/categories/snacks.png',
    sortOrder: 5,
  },
  {
    name: 'Pantry',
    slug: 'pantry',
    imageUrl: '/categories/pantry.png',
    sortOrder: 6,
  },
  {
    name: 'Frozen',
    slug: 'frozen',
    imageUrl: '/categories/frozen.png',
    sortOrder: 7,
  },
];

const subcategoryBlueprint: Record<string, string[]> = {
  'fruits-vegetables': [
    'Fresh Fruits',
    'Citrus Fruits',
    'Tropical Fruits',
    'Leafy Greens',
    'Root Vegetables',
    'Salad Vegetables',
    'Herbs & Microgreens',
    'Seasonal Produce',
  ],
  'dairy-eggs': [
    'Milk & Cream',
    'Curd & Yogurt',
    'Paneer & Cottage Cheese',
    'Cheese & Slices',
    'Butter & Spreads',
    'Eggs',
    'Flavored Milk',
    'Dairy Desserts',
  ],
  bakery: [
    'Everyday Bread',
    'Artisan Bread',
    'Buns & Rolls',
    'Cakes',
    'Cookies',
    'Pastries',
    'Muffins',
    'Brownies & Dessert Bars',
  ],
  beverages: [
    'Packaged Water',
    'Soft Drinks',
    'Fruit Juices',
    'Energy Drinks',
    'Tea',
    'Coffee',
    'Health Drinks',
    'Mixers & Soda',
  ],
  snacks: [
    'Chips',
    'Namkeen',
    'Biscuits',
    'Cookies',
    'Nuts & Dry Fruits',
    'Popcorn',
    'Protein Snacks',
    'Snack Bars',
  ],
  pantry: [
    'Rice',
    'Flours',
    'Pulses & Lentils',
    'Cooking Oils',
    'Spices & Masala',
    'Sugar & Sweeteners',
    'Sauces & Pastes',
    'Breakfast Essentials',
  ],
  frozen: [
    'Frozen Vegetables',
    'Frozen Fruits',
    'Frozen Snacks',
    'Frozen Ready Meals',
    'Frozen Parathas',
    'Ice Cream',
    'Frozen Seafood',
    'Frozen Meat',
  ],
};

const productPoolByCategory: Record<string, ProductPool> = {
  'fruits-vegetables': {
    adjectives: ['Fresh', 'Farm Fresh', 'Premium', 'Organic', 'Handpicked'],
    items: [
      'Banana',
      'Apple',
      'Orange',
      'Mango',
      'Spinach',
      'Carrot',
      'Tomato',
      'Cucumber',
      'Potato',
      'Coriander',
    ],
    brands: ['Local Farm', 'Green Basket', 'Nature Harvest', 'Daily Fresh'],
    units: ['250g', '500g', '1kg', 'each', 'bunch'],
    tags: ['fresh', 'produce', 'healthy'],
  },
  'dairy-eggs': {
    adjectives: ['Fresh', 'Creamy', 'Rich', 'Classic', 'Pure'],
    items: [
      'Whole Milk',
      'Toned Milk',
      'Greek Yogurt',
      'Fresh Curd',
      'Paneer',
      'Cheddar Cheese',
      'Butter',
      'Free Range Eggs',
      'Chocolate Milk',
      'Custard',
    ],
    brands: ['DairyFresh', 'Happy Hens', 'CreamLine', 'Daily Dairy'],
    units: ['200g', '500g', '1L', '2L', 'dozen'],
    tags: ['dairy', 'protein', 'daily'],
  },
  bakery: {
    adjectives: ['Freshly Baked', 'Soft', 'Butter', 'Golden', 'Classic'],
    items: [
      'White Bread',
      'Whole Wheat Bread',
      'Sourdough Loaf',
      'Burger Buns',
      'Tea Cake',
      'Chocolate Cookie',
      'Croissant',
      'Blueberry Muffin',
      'Brownie',
      'Garlic Roll',
    ],
    brands: ['Bakers Oven', 'Bread & Co', 'Patisserie', 'Bake House'],
    units: ['pack', '2 pack', '4 pack', '500g', '750g'],
    tags: ['bakery', 'fresh', 'snack'],
  },
  beverages: {
    adjectives: ['Refreshing', 'Chilled', 'Classic', 'Premium', 'Natural'],
    items: [
      'Mineral Water',
      'Cola',
      'Orange Juice',
      'Mango Juice',
      'Energy Drink',
      'Green Tea',
      'Instant Coffee',
      'Protein Shake',
      'Soda Water',
      'Lemon Drink',
    ],
    brands: ['CoolSip', 'AquaPure', 'JuiceFresh', 'BrewCraft'],
    units: ['250ml', '500ml', '1L', '2L', '6 pack'],
    tags: ['beverage', 'drink', 'refreshing'],
  },
  snacks: {
    adjectives: ['Crispy', 'Crunchy', 'Roasted', 'Classic', 'Spicy'],
    items: [
      'Potato Chips',
      'Namkeen Mix',
      'Digestive Biscuit',
      'Chocolate Cookie',
      'Almonds',
      'Cashews',
      'Butter Popcorn',
      'Protein Chips',
      'Granola Bar',
      'Trail Mix',
    ],
    brands: ['SnackBox', 'Crunchy', 'NutriMunch', 'TeaTime'],
    units: ['50g', '100g', '200g', '300g', 'pack'],
    tags: ['snack', 'quick-bite', 'tasty'],
  },
  pantry: {
    adjectives: ['Premium', 'Daily', 'Whole', 'Traditional', 'Refined'],
    items: [
      'Basmati Rice',
      'Atta Flour',
      'Toor Dal',
      'Moong Dal',
      'Sunflower Oil',
      'Garam Masala',
      'Turmeric Powder',
      'Brown Sugar',
      'Tomato Ketchup',
      'Rolled Oats',
    ],
    brands: ['KitchenPro', 'GrainGold', 'SpiceCraft', 'Home Pantry'],
    units: ['200g', '500g', '1kg', '2kg', '5kg', '1L'],
    tags: ['pantry', 'staple', 'cooking'],
  },
  frozen: {
    adjectives: ['Frozen', 'Quick Cook', 'Ready to Heat', 'Classic', 'Family'],
    items: [
      'Green Peas',
      'Mixed Vegetables',
      'Sweet Corn',
      'Veg Nuggets',
      'Pasta Meal',
      'Aloo Paratha',
      'Vanilla Ice Cream',
      'Fish Fillet',
      'Chicken Sausage',
      'Veg Pizza',
    ],
    brands: ['FreezeFresh', 'QuickBite', 'Frosty Farm', 'Cool Kitchen'],
    units: ['250g', '500g', '1kg', '2 pack', '4 pack'],
    tags: ['frozen', 'easy-meal', 'quick-cook'],
  },
};

const itemPoolBySubcategoryName: Record<string, string[]> = {
  'Fresh Fruits': [
    'Banana',
    'Apple',
    'Pear',
    'Guava',
    'Pomegranate',
    'Papaya',
    'Watermelon',
    'Grapes',
  ],
  'Citrus Fruits': [
    'Orange',
    'Sweet Lime',
    'Lemon',
    'Mandarin',
    'Grapefruit',
    'Lime',
    'Kinnow',
    'Citrus Mix',
  ],
  'Tropical Fruits': [
    'Mango',
    'Pineapple',
    'Dragon Fruit',
    'Passion Fruit',
    'Coconut',
    'Lychee',
    'Jackfruit',
    'Kiwi',
  ],
  'Leafy Greens': [
    'Spinach',
    'Lettuce',
    'Kale',
    'Fenugreek Leaves',
    'Amaranth Leaves',
    'Mustard Greens',
    'Pak Choi',
    'Swiss Chard',
  ],
  'Root Vegetables': [
    'Carrot',
    'Potato',
    'Beetroot',
    'Sweet Potato',
    'Radish',
    'Turnip',
    'Yam',
    'Ginger',
  ],
  'Salad Vegetables': [
    'Cucumber',
    'Tomato',
    'Capsicum',
    'Iceberg Lettuce',
    'Cherry Tomato',
    'Zucchini',
    'Celery',
    'Bell Pepper Mix',
  ],
  'Herbs & Microgreens': [
    'Coriander',
    'Mint',
    'Basil',
    'Parsley',
    'Dill',
    'Microgreen Mix',
    'Arugula',
    'Chives',
  ],
  'Seasonal Produce': [
    'Seasonal Fruit Mix',
    'Seasonal Veg Mix',
    'Fresh Berries',
    'Tender Peas',
    'Green Beans',
    'Plums',
    'Peaches',
    'Apricots',
  ],
  'Milk & Cream': [
    'Whole Milk',
    'Toned Milk',
    'Double Toned Milk',
    'Fresh Cream',
    'Low Fat Milk',
    'Full Cream Milk',
    'Cooking Cream',
    'Whipping Cream',
  ],
  'Curd & Yogurt': [
    'Fresh Curd',
    'Set Yogurt',
    'Greek Yogurt',
    'Probiotic Yogurt',
    'Low Fat Yogurt',
    'Hung Curd',
    'Strawberry Yogurt',
    'Mango Yogurt',
  ],
  'Paneer & Cottage Cheese': [
    'Fresh Paneer',
    'Malai Paneer',
    'Low Fat Paneer',
    'Cottage Cheese Cubes',
    'Paneer Block',
    'Smoked Paneer',
    'Herb Paneer',
    'Paneer Crumble',
  ],
  'Cheese & Slices': [
    'Cheddar Cheese',
    'Mozzarella Cheese',
    'Cheese Slices',
    'Processed Cheese',
    'Parmesan Cheese',
    'Gouda Cheese',
    'Cream Cheese',
    'Pizza Cheese',
  ],
  'Butter & Spreads': [
    'Salted Butter',
    'Unsalted Butter',
    'Garlic Butter',
    'Peanut Butter',
    'Chocolate Spread',
    'Almond Spread',
    'Fruit Jam',
    'Honey Spread',
  ],
  Eggs: [
    'Free Range Eggs',
    'Brown Eggs',
    'Country Eggs',
    'Omega 3 Eggs',
    'Farm Eggs',
    'Protein Eggs',
    'Jumbo Eggs',
    'Everyday Eggs',
  ],
  'Flavored Milk': [
    'Chocolate Milk',
    'Strawberry Milk',
    'Badam Milk',
    'Kesar Milk',
    'Vanilla Milk',
    'Coffee Milk',
    'Banana Milk',
    'Rose Milk',
  ],
  'Dairy Desserts': [
    'Custard',
    'Rice Pudding',
    'Chocolate Pudding',
    'Mousse',
    'Caramel Dessert',
    'Fruit Yogurt Dessert',
    'Cheesecake Cup',
    'Milk Cake Dessert',
  ],
  'Everyday Bread': [
    'White Bread',
    'Brown Bread',
    'Whole Wheat Bread',
    'Milk Bread',
    'Multigrain Bread',
    'Sandwich Bread',
    'Fiber Bread',
    'Classic Bread Loaf',
  ],
  'Artisan Bread': [
    'Sourdough Loaf',
    'Baguette',
    'Ciabatta',
    'Focaccia',
    'Rye Bread',
    'Olive Bread',
    'Seeded Loaf',
    'Country Bread',
  ],
  'Buns & Rolls': [
    'Burger Buns',
    'Hot Dog Rolls',
    'Dinner Rolls',
    'Garlic Rolls',
    'Pav Buns',
    'Brioche Buns',
    'Milk Rolls',
    'Whole Wheat Buns',
  ],
  Cakes: [
    'Vanilla Cake',
    'Chocolate Cake',
    'Fruit Cake',
    'Red Velvet Cake',
    'Pineapple Cake',
    'Tea Cake',
    'Marble Cake',
    'Sponge Cake',
  ],
  Cookies: [
    'Chocolate Cookie',
    'Butter Cookie',
    'Oat Cookie',
    'Jeera Cookie',
    'Almond Cookie',
    'Coconut Cookie',
    'Shortbread Cookie',
    'Double Choco Cookie',
  ],
  Pastries: [
    'Croissant',
    'Chocolate Pastry',
    'Strawberry Pastry',
    'Puff Pastry',
    'Danish Pastry',
    'Custard Pastry',
    'Cheese Pastry',
    'Cream Roll',
  ],
  Muffins: [
    'Blueberry Muffin',
    'Chocolate Muffin',
    'Banana Muffin',
    'Vanilla Muffin',
    'Bran Muffin',
    'Coffee Muffin',
    'Fruit Muffin',
    'Walnut Muffin',
  ],
  'Brownies & Dessert Bars': [
    'Chocolate Brownie',
    'Walnut Brownie',
    'Blondie Bar',
    'Fudge Bar',
    'Caramel Bar',
    'Cookie Bar',
    'Mocha Brownie',
    'Choco Chip Bar',
  ],
  'Packaged Water': [
    'Mineral Water',
    'Spring Water',
    'Alkaline Water',
    'Flavored Water',
    'Electrolyte Water',
    'Sparkling Water',
    'Natural Water',
    'RO Water',
  ],
  'Soft Drinks': [
    'Cola',
    'Lemon Soda',
    'Orange Soda',
    'Ginger Ale',
    'Tonic Water',
    'Diet Cola',
    'Club Soda',
    'Fruit Soda',
  ],
  'Fruit Juices': [
    'Orange Juice',
    'Mango Juice',
    'Apple Juice',
    'Mixed Fruit Juice',
    'Guava Juice',
    'Pineapple Juice',
    'Pomegranate Juice',
    'Grape Juice',
  ],
  'Energy Drinks': [
    'Energy Drink',
    'Zero Sugar Energy Drink',
    'Electrolyte Drink',
    'Sports Drink',
    'Performance Drink',
    'Caffeine Boost Drink',
    'Hydration Drink',
    'Endurance Drink',
  ],
  Tea: [
    'Assam Tea',
    'Darjeeling Tea',
    'Green Tea',
    'Masala Tea',
    'Lemon Tea',
    'Herbal Tea',
    'Black Tea',
    'Chamomile Tea',
  ],
  Coffee: [
    'Instant Coffee',
    'Filter Coffee',
    'Dark Roast Coffee',
    'Arabica Coffee',
    'Cold Brew Coffee',
    'Mocha Coffee',
    'Cappuccino Mix',
    'Latte Mix',
  ],
  'Health Drinks': [
    'Protein Shake',
    'Malted Drink',
    'Chocolate Health Drink',
    'Kids Nutrition Drink',
    'High Fiber Drink',
    'Immunity Drink',
    'Meal Replacement Drink',
    'Weight Gain Drink',
  ],
  'Mixers & Soda': [
    'Soda Water',
    'Tonic Mixer',
    'Lime Mixer',
    'Ginger Mixer',
    'Mocktail Mixer',
    'Club Mixer',
    'Bitter Lemon Mixer',
    'Sparkling Mixer',
  ],
  Chips: [
    'Potato Chips',
    'Tortilla Chips',
    'Banana Chips',
    'Nacho Chips',
    'Ridge Chips',
    'Kettle Chips',
    'Masala Chips',
    'Salted Chips',
  ],
  Namkeen: [
    'Namkeen Mix',
    'Bhujia',
    'Sev',
    'Moong Dal Namkeen',
    'Chivda',
    'Peanut Namkeen',
    'Spicy Mixture',
    'Aloo Bhujia',
  ],
  Biscuits: [
    'Digestive Biscuit',
    'Marie Biscuit',
    'Butter Biscuit',
    'Jeera Biscuit',
    'Cream Biscuit',
    'Salted Biscuit',
    'Whole Wheat Biscuit',
    'Glucose Biscuit',
  ],
  'Nuts & Dry Fruits': [
    'Almonds',
    'Cashews',
    'Walnuts',
    'Pistachios',
    'Raisins',
    'Dates',
    'Anjeer',
    'Dry Fruit Mix',
  ],
  Popcorn: [
    'Butter Popcorn',
    'Cheese Popcorn',
    'Caramel Popcorn',
    'Salted Popcorn',
    'Peri Peri Popcorn',
    'Microwave Popcorn',
    'Classic Popcorn',
    'Spicy Popcorn',
  ],
  'Protein Snacks': [
    'Protein Chips',
    'Roasted Chickpeas',
    'Roasted Makhana',
    'Protein Bites',
    'Soy Crisps',
    'Roasted Edamame',
    'Lentil Crisps',
    'Protein Mix',
  ],
  'Snack Bars': [
    'Granola Bar',
    'Peanut Bar',
    'Date Bar',
    'Oats Bar',
    'Protein Bar',
    'Fruit & Nut Bar',
    'Chocolate Bar',
    'Energy Bar',
  ],
  Rice: [
    'Basmati Rice',
    'Sona Masoori Rice',
    'Brown Rice',
    'Kolam Rice',
    'Jeera Rice',
    'Steam Rice',
    'Raw Rice',
    'Premium Rice',
  ],
  Flours: [
    'Wheat Flour',
    'Maida Flour',
    'Besan Flour',
    'Ragi Flour',
    'Bajra Flour',
    'Rice Flour',
    'Multi Grain Flour',
    'Jowar Flour',
  ],
  'Pulses & Lentils': [
    'Toor Dal',
    'Moong Dal',
    'Masoor Dal',
    'Urad Dal',
    'Chana Dal',
    'Rajma',
    'Chole',
    'Mixed Lentils',
  ],
  'Cooking Oils': [
    'Sunflower Oil',
    'Mustard Oil',
    'Groundnut Oil',
    'Rice Bran Oil',
    'Olive Oil',
    'Sesame Oil',
    'Coconut Oil',
    'Refined Oil',
  ],
  'Spices & Masala': [
    'Turmeric Powder',
    'Red Chilli Powder',
    'Coriander Powder',
    'Garam Masala',
    'Cumin Powder',
    'Black Pepper',
    'Sambar Masala',
    'Pav Bhaji Masala',
  ],
  'Sugar & Sweeteners': [
    'White Sugar',
    'Brown Sugar',
    'Jaggery Powder',
    'Honey',
    'Stevia',
    'Rock Sugar',
    'Coconut Sugar',
    'Date Syrup',
  ],
  'Sauces & Pastes': [
    'Tomato Ketchup',
    'Chilli Sauce',
    'Soy Sauce',
    'Pasta Sauce',
    'Pizza Sauce',
    'Ginger Garlic Paste',
    'Green Chutney',
    'Schezwan Sauce',
  ],
  'Breakfast Essentials': [
    'Rolled Oats',
    'Corn Flakes',
    'Muesli',
    'Choco Flakes',
    'Peanut Butter',
    'Honey Oats',
    'Porridge Mix',
    'Breakfast Cereal',
  ],
  'Frozen Vegetables': [
    'Frozen Green Peas',
    'Frozen Mixed Vegetables',
    'Frozen Sweet Corn',
    'Frozen Broccoli',
    'Frozen Spinach',
    'Frozen Carrot Cubes',
    'Frozen Cauliflower',
    'Frozen Veg Mix',
  ],
  'Frozen Fruits': [
    'Frozen Mango Cubes',
    'Frozen Berries',
    'Frozen Pineapple',
    'Frozen Strawberries',
    'Frozen Blueberries',
    'Frozen Fruit Mix',
    'Frozen Cherries',
    'Frozen Banana Slices',
  ],
  'Frozen Snacks': [
    'Frozen Veg Nuggets',
    'Frozen French Fries',
    'Frozen Spring Rolls',
    'Frozen Samosa',
    'Frozen Cheese Bites',
    'Frozen Corn Cheese Balls',
    'Frozen Garlic Bread',
    'Frozen Momos',
  ],
  'Frozen Ready Meals': [
    'Frozen Pasta Meal',
    'Frozen Veg Pizza',
    'Frozen Noodle Bowl',
    'Frozen Rice Bowl',
    'Frozen Lasagna',
    'Frozen Mac and Cheese',
    'Frozen Veg Curry Meal',
    'Frozen Stir Fry Meal',
  ],
  'Frozen Parathas': [
    'Frozen Aloo Paratha',
    'Frozen Laccha Paratha',
    'Frozen Plain Paratha',
    'Frozen Methi Paratha',
    'Frozen Paneer Paratha',
    'Frozen Garlic Paratha',
    'Frozen Onion Paratha',
    'Frozen Mix Veg Paratha',
  ],
  'Ice Cream': [
    'Vanilla Ice Cream',
    'Chocolate Ice Cream',
    'Strawberry Ice Cream',
    'Butterscotch Ice Cream',
    'Mango Ice Cream',
    'Kulfi Ice Cream',
    'Cookie Cream Ice Cream',
    'Family Pack Ice Cream',
  ],
  'Frozen Seafood': [
    'Frozen Fish Fillet',
    'Frozen Prawns',
    'Frozen Basa Fillet',
    'Frozen Tuna Chunks',
    'Frozen Crab Sticks',
    'Frozen Seafood Mix',
    'Frozen Fish Fingers',
    'Frozen Squid Rings',
  ],
  'Frozen Meat': [
    'Frozen Chicken Sausage',
    'Frozen Chicken Nuggets',
    'Frozen Chicken Breast',
    'Frozen Mutton Chops',
    'Frozen Minced Meat',
    'Frozen Meatballs',
    'Frozen Chicken Wings',
    'Frozen Seekh Kebab',
  ],
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSubcategories(categories: TopCategory[]): Subcategory[] {
  const results: Subcategory[] = [];

  for (const category of categories) {
    const names = subcategoryBlueprint[category.slug] || [];
    for (let i = 1; i <= SUBCATEGORIES_PER_CATEGORY; i++) {
      const name = names[i - 1] || `${category.name} ${i}`;
      results.push({
        name,
        slug: `${category.slug}-${slugify(name)}`,
        parentSlug: category.slug,
        imageUrl: category.imageUrl,
        sortOrder: i,
      });
    }
  }

  return results;
}

function getUnitsForSubcategory(subcategoryName: string, fallback: string[]) {
  const name = subcategoryName.toLowerCase();

  if (name.includes('tea') || name.includes('coffee')) {
    return ['100g', '250g', '500g', '25 sachets', '50 sachets'];
  }
  if (
    name.includes('soft drinks') ||
    name.includes('mixers') ||
    name.includes('water') ||
    name.includes('juices') ||
    name.includes('energy') ||
    name.includes('health drinks')
  ) {
    return ['250ml', '500ml', '1L', '2L', '6 pack'];
  }
  if (name.includes('eggs')) {
    return ['6 pack', '12 pack', '18 pack', '24 pack'];
  }
  if (
    name.includes('rice') ||
    name.includes('flours') ||
    name.includes('pulses')
  ) {
    return ['500g', '1kg', '2kg', '5kg'];
  }
  if (name.includes('oils')) {
    return ['500ml', '1L', '2L', '5L'];
  }
  if (name.includes('spices') || name.includes('masala')) {
    return ['100g', '200g', '500g'];
  }
  if (name.includes('bread') || name.includes('buns') || name.includes('rolls')) {
    return ['1 pack', '2 pack', '4 pack', '500g', '750g'];
  }
  if (
    name.includes('fruits') ||
    name.includes('vegetables') ||
    name.includes('greens') ||
    name.includes('produce') ||
    name.includes('herbs')
  ) {
    return ['250g', '500g', '1kg', 'each', 'bunch'];
  }
  if (
    name.includes('chips') ||
    name.includes('namkeen') ||
    name.includes('biscuits') ||
    name.includes('cookies') ||
    name.includes('popcorn') ||
    name.includes('snack') ||
    name.includes('nuts')
  ) {
    return ['50g', '100g', '200g', '300g', '1 pack'];
  }
  if (name.includes('ice cream')) {
    return ['100ml', '500ml', '1L', 'family pack'];
  }
  if (name.includes('seafood') || name.includes('meat')) {
    return ['250g', '500g', '1kg', '1 pack'];
  }

  return fallback;
}

function buildProducts(subcategories: Subcategory[]): SeedProduct[] {
  const products: SeedProduct[] = [];

  for (const sub of subcategories) {
    const pool = productPoolByCategory[sub.parentSlug];
    if (!pool) {
      continue;
    }

    const subItems = itemPoolBySubcategoryName[sub.name] || pool.items;
  const unitOptions = getUnitsForSubcategory(sub.name, pool.units);

    for (let i = 1; i <= PRODUCTS_PER_SUBCATEGORY; i++) {
      const adjective = pool.adjectives[(i - 1) % pool.adjectives.length];
      const item = subItems[(i - 1) % subItems.length];
      const rawName = `${adjective} ${item}`;
      const basePrice = Number(
        faker.commerce.price({ min: 0.8, max: 18, dec: 2 }),
      );
      const hasComparePrice = faker.datatype.boolean(0.65);
      const comparePrice = hasComparePrice
        ? Number(
            (
              basePrice *
              faker.number.float({ min: 1.05, max: 1.35, fractionDigits: 2 })
            ).toFixed(2),
          )
        : null;

      products.push({
        name: `${rawName} ${i}`,
        slug: `${sub.slug}-${slugify(rawName)}-${i}`,
        price: basePrice,
        comparePrice,
        unit: unitOptions[(i - 1) % unitOptions.length],
        categorySlug: sub.slug,
        inStock: faker.datatype.boolean(0.9),
        stockQty: faker.number.int({ min: 10, max: 220 }),
        tags: [...pool.tags, ...slugify(sub.name).split('-').slice(0, 2)],
        brand: pool.brands[(i - 1) % pool.brands.length],
        description: `${rawName} from ${sub.name}, packed for daily grocery needs.`,
      });
    }
  }

  return products;
}

async function seedMongo() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db('groceries');

    faker.seed(20260331);

    const subcategories = buildSubcategories(topLevelCategories);
    const products = buildProducts(subcategories);

    await db.collection('categories').deleteMany({});
    await db.collection('products').deleteMany({});

    const topCatDocs = await db
      .collection('categories')
      .insertMany(topLevelCategories);

    const topLevelMap = new Map(
      topLevelCategories.map((c, i) => [c.slug, topCatDocs.insertedIds[i]]),
    );

    const subcategoryDocs = subcategories.map((sub) => ({
      name: sub.name,
      slug: sub.slug,
      imageUrl: sub.imageUrl,
      sortOrder: sub.sortOrder,
      parentId: topLevelMap.get(sub.parentSlug)?.toString() || null,
    }));

    const subCatDocs = await db
      .collection('categories')
      .insertMany(subcategoryDocs);

    const categoryMap = new Map<string, string>();
    subcategories.forEach((sub, i) => {
      categoryMap.set(sub.slug, subCatDocs.insertedIds[i]?.toString() || '');
    });

    console.log(
      `✅ Inserted ${topCatDocs.insertedCount + subCatDocs.insertedCount} categories (${topCatDocs.insertedCount} top-level + ${subCatDocs.insertedCount} subcategories)`,
    );

    const productDocs = products.map((p) => ({
      ...p,
      price: Number((p.price * PRICE_MULTIPLIER).toFixed(2)),
      comparePrice:
        p.comparePrice !== null
          ? Number((p.comparePrice * PRICE_MULTIPLIER).toFixed(2))
          : null,
      categoryId: categoryMap.get(p.categorySlug) || '',
      imageUrl: `https://via.placeholder.com/300x200?text=${encodeURIComponent(p.name)}`,
    }));

    const productResult = await db.collection('products').insertMany(productDocs);

    console.log(`✅ Inserted ${productResult.insertedCount} products`);
    console.log(
      `ℹ️  Target shape: ${SUBCATEGORIES_PER_CATEGORY} subcategories/top-level category, ${PRODUCTS_PER_SUBCATEGORY} products/subcategory`,
    );
  } finally {
    await client.close();
  }
}

async function seedPostgres() {
  const pool = new postgres.Pool({ connectionString: DB_URL });

  try {
    const result = await pool.query('SELECT NOW()');
    if (result.rows[0]) {
      console.log('✅ PostgreSQL connected (tables auto-created by TypeORM)');
    }
  } catch (err: any) {
    if (err.message?.includes('does not exist')) {
      console.log(
        '⚠️  PostgreSQL connection OK (tables will be created by TypeORM on startup)',
      );
    } else {
      throw err;
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('🌱 Seeding databases...');
  await seedMongo();
  await seedPostgres();
  console.log('✅ Seeding complete!');
}

main().catch(console.error);
