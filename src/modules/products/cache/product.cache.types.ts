/**
 * 产品缓存类型定义
 */

export interface CachedProduct {
  id: string;
  name: string;
  description: string | null;
  code: string;
  sku: string;
  basePrice: number;
  totalStock: number;
  minStock: number;
  status: string;
  isFeatured: boolean;
  sort: number;
  images: string | null;
  videoUrl: string | null;
  details: string | null;
  scheduleOnAt: Date | null;
  scheduleOffAt: Date | null;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    level: number;
    parent?: {
      id: string;
      name: string;
    };
  };
  shop?: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductListItem {
  id: string;
  name: string;
  description: string | null;
  code: string;
  sku: string;
  basePrice: number;
  totalStock: number;
  status: string;
  isFeatured: boolean;
  sort: number;
  images: string | null;
  categoryId: string;
  createdAt: Date;
}

export interface ProductSearchResult {
  query: string;
  products: ProductListItem[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  facets?: {
    categories: Array<{
      id: string;
      name: string;
      count: number;
    }>;
    priceRanges: Array<{
      min: number;
      max: number;
      count: number;
    }>;
  };
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  level: number;
  parentId?: string;
  path?: string;
  icon?: string;
  image?: string;
  isActive: boolean;
  sort: number;
  productCount?: number;
  children?: ProductCategory[];
  parent?: ProductCategory;
}

export interface ProductPrice {
  productId: string;
  basePrice: number;
  userLevelPrice: number;
  discount: number;
  userLevel?: string;
  validUntil?: Date;
}

export interface ProductStock {
  productId: string;
  totalStock: number;
  availableStock: number;
  warehouseStock: number;
  reservedStock: number;
  lowStockThreshold: number;
  lastUpdated: Date;
}

export interface ProductRecommendation {
  userId: string;
  recommendations: Array<{
    productId: string;
    name: string;
    price: number;
    image: string;
    score: number;
    reason: string;
  }>;
  reason: string;
  generatedAt: Date;
  expiresAt: Date;
}

export interface ProductRating {
  productId: string;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  lastUpdated: Date;
}

export interface ProductViewHistory {
  userId?: string;
  sessionId?: string;
  productId: string;
  viewedAt: Date;
  duration?: number;
  source?: string;
}

export interface ProductHotData {
  period: 'hour' | 'day' | 'week' | 'month';
  products: Array<{
    productId: string;
    name: string;
    views: number;
    sales: number;
    revenue: number;
    rank: number;
  }>;
  updatedAt: Date;
}

export interface ProductTag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  productCount: number;
  isActive: boolean;
  createdAt: Date;
}

export interface ProductSpec {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect';
  required: boolean;
  filterable: boolean;
  sortable: boolean;
  options?: Array<{
    value: string;
    label: string;
    price?: number;
  }>;
  sort: number;
  isActive: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  image?: string;
  specs: Record<string, any>;
  isActive: boolean;
  sort: number;
}

export interface ProductCacheStats {
  totalCached: number;
  byType: {
    productDetail: number;
    productList: number;
    categoryTree: number;
    searchResults: number;
    recommendations: number;
    prices: number;
    stocks: number;
  };
  hitRate: number;
  memoryUsage: number;
  lastUpdate: Date;
}