# 中道商城商品模块 API 文档

## 概述

商品模块提供完整的商品管理功能，包括商品CRUD操作、规格管理、分类体系、标签系统和差异化定价。

**基础信息**
- 基础URL: `http://localhost:3000/api/v1/products`
- 认证方式: Bearer Token (JWT)
- 数据格式: JSON

## 1. 商品管理

### 1.1 创建商品

**接口地址**: `POST /products`

**描述**: 创建新商品

**权限要求**: 管理员 或 星级店长

**请求体**:
```json
{
  "categoryId": "cat_001",
  "name": "有机蔬菜礼盒",
  "description": "精选有机蔬菜组合装，新鲜直达",
  "code": "VEG-001",
  "sku": "VEG-ORG-001",
  "basePrice": 9900,
  "images": [
    "https://example.com/images/product1.jpg",
    "https://example.com/images/product1-2.jpg"
  ],
  "videos": [
    "https://example.com/videos/product1.mp4"
  ],
  "specifications": [
    {
      "name": "规格",
      "type": "select",
      "required": true,
      "options": [
        {"value": "small", "label": "小份(2kg)", "price": 9900},
        {"value": "large", "label": "大份(5kg)", "price": 23900}
      ]
    }
  ],
  "tags": ["有机", "新鲜", "礼盒"],
  "status": "active"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "prod_001",
    "categoryId": "cat_001",
    "name": "有机蔬菜礼盒",
    "description": "精选有机蔬菜组合装，新鲜直达",
    "code": "VEG-001",
    "sku": "VEG-ORG-001",
    "basePrice": 9900,
    "images": [
      "https://example.com/images/product1.jpg",
      "https://example.com/images/product1-2.jpg"
    ],
    "videos": [
      "https://example.com/videos/product1.mp4"
    ],
    "specifications": [
      {
        "id": "spec_001",
        "name": "规格",
        "type": "select",
        "required": true,
        "options": [
          {"id": "opt_001", "value": "small", "label": "小份(2kg)", "price": 9900},
          {"id": "opt_002", "value": "large", "label": "大份(5kg)", "price": 23900}
        ]
      }
    ],
    "tags": ["有机", "新鲜", "礼盒"],
    "status": "active",
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z"
  },
  "message": "商品创建成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1.2 获取商品列表

**接口地址**: `GET /products`

**描述**: 获取商品列表（支持分页和筛选）

**权限要求**: 无需认证（公开接口）

**查询参数**:
- `page`: 页码（默认1）
- `perPage`: 每页数量（默认20，最大100）
- `categoryId`: 分类ID筛选
- `status`: 状态筛选（active/inactive）
- `tags`: 标签筛选（多个用逗号分隔）
- `minPrice`: 最低价格（分为单位）
- `maxPrice`: 最高价格（分为单位）
- `search`: 搜索关键词（商品名称、描述）
- `sortBy`: 排序字段（name/price/createdAt/sales）
- `sortOrder`: 排序方向（asc/desc）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "prod_001",
        "categoryId": "cat_001",
        "categoryName": "蔬菜水果",
        "name": "有机蔬菜礼盒",
        "description": "精选有机蔬菜组合装，新鲜直达",
        "code": "VEG-001",
        "sku": "VEG-ORG-001",
        "basePrice": 9900,
        "finalPrice": {
          "regular": 9900,
          "vip": 9400,
          "member1": 8900
        },
        "images": [
          "https://example.com/images/product1.jpg"
        ],
        "tags": ["有机", "新鲜", "礼盒"],
        "status": "active",
        "totalStock": 500,
        "salesCount": 1250,
        "rating": 4.8,
        "reviewCount": 230,
        "createdAt": "2024-01-01T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1.3 获取商品详情

**接口地址**: `GET /products/:id`

**描述**: 获取指定商品的详细信息

**权限要求**: 无需认证（公开接口）

**路径参数**:
- `id`: 商品ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "prod_001",
    "categoryId": "cat_001",
    "category": {
      "id": "cat_001",
      "name": "蔬菜水果",
      "parentId": null,
      "level": 1
    },
    "name": "有机蔬菜礼盒",
    "description": "精选有机蔬菜组合装，新鲜直达。包含当季最新鲜的有机蔬菜，经过严格的质量检测，确保食品安全。",
    "code": "VEG-001",
    "sku": "VEG-ORG-001",
    "basePrice": 9900,
    "finalPrice": {
      "regular": 9900,
      "vip": 9400,
      "member1": 8900,
      "member2": 8500,
      "member3": 8100,
      "member4": 7700,
      "member5": 7300,
      "director": 6900
    },
    "images": [
      {
        "url": "https://example.com/images/product1.jpg",
        "alt": "有机蔬菜礼盒主图",
        "sort": 1
      },
      {
        "url": "https://example.com/images/product1-2.jpg",
        "alt": "有机蔬菜礼盒细节图",
        "sort": 2
      }
    ],
    "videos": [
      {
        "url": "https://example.com/videos/product1.mp4",
        "cover": "https://example.com/videos/product1-cover.jpg",
        "duration": 30
      }
    ],
    "specifications": [
      {
        "id": "spec_001",
        "name": "规格",
        "type": "select",
        "required": true,
        "options": [
          {
            "id": "opt_001",
            "value": "small",
            "label": "小份(2kg)",
            "price": 9900,
            "stock": 300
          },
          {
            "id": "opt_002",
            "value": "large",
            "label": "大份(5kg)",
            "price": 23900,
            "stock": 200
          }
        ]
      }
    ],
    "tags": ["有机", "新鲜", "礼盒", "热销"],
    "status": "active",
    "stock": {
      "total": 500,
      "available": 480,
      "reserved": 20
    },
    "sales": {
      "total": 1250,
      "thisMonth": 320,
      "thisWeek": 85
    },
    "rating": {
      "average": 4.8,
      "count": 230,
      "distribution": {
        "5": 150,
        "4": 60,
        "3": 15,
        "2": 3,
        "1": 2
      }
    },
    "shipping": {
      "weight": 2000,
      "volume": 5000,
      "freeShipping": true,
      "shippingFee": 0
    },
    "seo": {
      "title": "有机蔬菜礼盒 - 中道商城",
      "keywords": "有机蔬菜,新鲜蔬菜,礼盒",
      "description": "精选有机蔬菜礼盒，新鲜直达，健康之选"
    },
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-10T15:30:00Z"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1.4 更新商品

**接口地址**: `PUT /products/:id`

**描述**: 更新商品信息

**权限要求**: 管理员 或 星级店长

**路径参数**:
- `id`: 商品ID

**请求体**: 与创建商品相同，所有字段可选

**响应示例**:
```json
{
  "success": true,
  "data": {
    // 更新后的商品信息
  },
  "message": "商品更新成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1.5 删除商品

**接口地址**: `DELETE /products/:id`

**描述**: 删除商品（软删除）

**权限要求**: 管理员

**路径参数**:
- `id`: 商品ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "prod_001",
    "deleted": true
  },
  "message": "商品删除成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 2. 批量操作

### 2.1 批量创建商品

**接口地址**: `POST /products/batch`

**描述**: 批量创建商品

**权限要求**: 管理员

**请求体**:
```json
{
  "products": [
    {
      "categoryId": "cat_001",
      "name": "商品1",
      "code": "PROD-001",
      "basePrice": 9900
    },
    {
      "categoryId": "cat_002",
      "name": "商品2",
      "code": "PROD-002",
      "basePrice": 15900
    }
  ]
}
```

### 2.2 批量更新状态

**接口地址**: `PUT /products/batch/status`

**描述**: 批量更新商品状态

**权限要求**: 管理员

**请求体**:
```json
{
  "ids": ["prod_001", "prod_002"],
  "status": "inactive"
}
```

### 2.3 批量删除商品

**接口地址**: `DELETE /products/batch`

**描述**: 批量删除商品

**权限要求**: 管理员

**请求体**:
```json
{
  "ids": ["prod_001", "prod_002"]
}
```

## 3. 商品分类管理

### 3.1 获取分类树

**接口地址**: `GET /products/categories`

**描述**: 获取商品分类树形结构

**权限要求**: 无需认证

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "cat_001",
      "name": "蔬菜水果",
      "parentId": null,
      "level": 1,
      "icon": "https://example.com/icons/vegetables.png",
      "children": [
        {
          "id": "cat_001_001",
          "name": "叶菜类",
          "parentId": "cat_001",
          "level": 2,
          "children": []
        },
        {
          "id": "cat_001_002",
          "name": "根茎类",
          "parentId": "cat_001",
          "level": 2,
          "children": []
        }
      ],
      "productCount": 150
    }
  ],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 3.2 创建分类

**接口地址**: `POST /products/categories`

**描述**: 创建商品分类

**权限要求**: 管理员

**请求体**:
```json
{
  "name": "肉类禽蛋",
  "parentId": null,
  "icon": "https://example.com/icons/meat.png",
  "sort": 2
}
```

### 3.3 更新分类

**接口地址**: `PUT /products/categories/:id`

**描述**: 更新商品分类

**权限要求**: 管理员

### 3.4 删除分类

**接口地址**: `DELETE /products/categories/:id`

**描述**: 删除商品分类（需先删除子分类和商品）

**权限要求**: 管理员

## 4. 商品标签管理

### 4.1 获取标签列表

**接口地址**: `GET /products/tags`

**描述**: 获取所有商品标签

**权限要求**: 无需认证

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "tag_001",
      "name": "有机",
      "color": "#52c41a",
      "productCount": 85
    },
    {
      "id": "tag_002",
      "name": "新鲜",
      "color": "#1890ff",
      "productCount": 200
    }
  ],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 4.2 创建标签

**接口地址**: `POST /products/tags`

**描述**: 创建商品标签

**权限要求**: 管理员

**请求体**:
```json
{
  "name": "限量版",
  "color": "#ff4d4f"
}
```

## 5. 商品搜索

### 5.1 高级搜索

**接口地址**: `GET /products/search`

**描述**: 商品高级搜索（支持全文搜索）

**权限要求**: 无需认证

**查询参数**:
- `q`: 搜索关键词
- `categoryId`: 分类筛选
- `tags`: 标签筛选
- `priceRange`: 价格区间（格式: min,max）
- `rating`: 最低评分
- `inStock`: 是否有货
- `sort`: 排序方式（relevance/price_asc/price_desc/sales）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {},
    "facets": {
      "categories": [
        {
          "id": "cat_001",
          "name": "蔬菜水果",
          "count": 45
        }
      ],
      "tags": [
        {
          "id": "tag_001",
          "name": "有机",
          "count": 30
        }
      ],
      "priceRanges": [
        {
          "range": "0-10000",
          "count": 25,
          "label": "0-100元"
        }
      ]
    },
    "suggestions": [
      "有机蔬菜",
      "新鲜水果",
      "精选礼盒"
    ]
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 6. 商品推荐

### 6.1 获取推荐商品

**接口地址**: `GET /products/recommendations`

**描述**: 获取个性化推荐商品

**权限要求**: 需要登录（基于用户画像推荐）

**查询参数**:
- `type`: 推荐类型（similar/bestseller/newarrival/personalized）
- `productId`: 商品ID（获取相似商品时需要）
- `limit`: 返回数量（默认10）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "type": "similar",
    "products": [
      {
        "id": "prod_002",
        "name": "有机水果礼盒",
        "price": 12900,
        "image": "https://example.com/images/product2.jpg",
        "similarity": 0.85
      }
    ],
    "reason": "基于您的浏览历史推荐"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 7. 价格计算

### 7.1 计算商品价格

**接口地址**: `GET /products/:id/price`

**描述**: 根据用户等级计算商品价格

**权限要求**: 需要登录

**路径参数**:
- `id`: 商品ID

**查询参数**:
- `quantity`: 购买数量（用于批量折扣）
- `specs`: 规格组合（JSON格式）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "productId": "prod_001",
    "basePrice": 9900,
    "userLevel": "VIP",
    "finalPrice": 9400,
    "discount": {
      "type": "level_discount",
      "amount": 500,
      "rate": 0.05
    },
    "totalPrice": 9400,
    "breakdown": {
      "subtotal": 9900,
      "discount": -500,
      "tax": 0,
      "shipping": 0
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 8. 库存查询

### 8.1 获取商品库存

**接口地址**: `GET /products/:id/stock`

**描述**: 查询商品在各个仓库的库存情况

**权限要求**: 需要登录

**响应示例**:
```json
{
  "success": true,
  "data": {
    "productId": "prod_001",
    "totalStock": 500,
    "available": 480,
    "reserved": 20,
    "warehouses": [
      {
        "id": "wh_001",
        "name": "中心仓库",
        "stock": 300,
        "available": 290
      },
      {
        "id": "wh_002",
        "name": "华东仓库",
        "stock": 200,
        "available": 190
      }
    ]
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 9. 商品评价

### 9.1 获取商品评价

**接口地址**: `GET /products/:id/reviews`

**描述**: 获取商品评价列表

**权限要求**: 无需认证

**查询参数**:
- `page`: 页码
- `perPage`: 每页数量
- `rating`: 评分筛选（1-5）
- `sort`: 排序方式（newest/helpful/rating_high/rating_low）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "averageRating": 4.8,
      "totalReviews": 230,
      "ratingDistribution": {
        "5": 150,
        "4": 60,
        "3": 15,
        "2": 3,
        "1": 2
      }
    },
    "reviews": [
      {
        "id": "review_001",
        "userId": "user_001",
        "userName": "张三",
        "rating": 5,
        "content": "非常新鲜，品质很好！",
        "images": [
          "https://example.com/reviews/img1.jpg"
        ],
        "helpful": 25,
        "createdAt": "2024-01-01T10:00:00Z"
      }
    ],
    "pagination": {}
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 10. 错误码说明

| 错误码 | HTTP状态码 | 说明 |
|--------|------------|------|
| PRODUCT_NOT_FOUND | 404 | 商品不存在 |
| CATEGORY_NOT_FOUND | 404 | 分类不存在 |
| INVALID_PRICE | 400 | 无效的价格 |
| INSUFFICIENT_STOCK | 400 | 库存不足 |
| DUPLICATE_CODE | 400 | 商品编码重复 |
| CATEGORY_HAS_PRODUCTS | 400 | 分类下有商品，无法删除 |
| INVALID_SPECIFICATION | 400 | 无效的商品规格 |

## 11. SDK 示例

### JavaScript/TypeScript

```typescript
class ProductService {
  private baseURL = 'http://localhost:3000/api/v1/products';
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  // 获取商品列表
  async getProducts(params: {
    page?: number;
    perPage?: number;
    categoryId?: string;
    search?: string;
  }) {
    const queryString = new URLSearchParams(params as any).toString();
    const response = await fetch(`${this.baseURL}?${queryString}`);
    return response.json();
  }

  // 获取商品详情
  async getProduct(id: string) {
    const response = await fetch(`${this.baseURL}/${id}`);
    return response.json();
  }

  // 创建商品
  async createProduct(productData: any) {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });
    return response.json();
  }

  // 计算价格
  async calculatePrice(productId: string, quantity: number = 1) {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(
      `${this.baseURL}/${productId}/price?quantity=${quantity}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );
    return response.json();
  }
}

// 使用示例
const productService = new ProductService('your-jwt-token');

// 获取商品列表
const products = await productService.getProducts({
  page: 1,
  perPage: 20,
  categoryId: 'cat_001'
});

// 创建商品
const newProduct = await productService.createProduct({
  name: '新商品',
  basePrice: 9900,
  categoryId: 'cat_001'
});

// 计算价格
const priceInfo = await productService.calculatePrice('prod_001', 2);
```

## 12. 最佳实践

### 12.1 性能优化

1. **合理使用分页**: 避免一次性加载大量数据
2. **缓存策略**: 对商品详情进行缓存
3. **图片优化**: 使用CDN加速图片加载
4. **懒加载**: 商品图片使用懒加载技术

### 12.2 安全建议

1. **输入验证**: 对所有输入进行验证
2. **权限控制**: 严格控制创建、修改、删除权限
3. **防刷机制**: 防止恶意请求刷取商品数据

### 12.3 业务规则

1. **价格计算**: 基于用户等级的差异化定价
2. **库存管理**: 多仓库统一管理
3. **商品状态**: 上架/下架状态控制
4. **规格组合**: 支持复杂的商品规格组合

## 13. 更新日志

- v1.0.0 (2024-01-01): 初始版本发布
- v1.1.0 (2024-01-15): 新增批量操作接口
- v1.2.0 (2024-02-01): 增强搜索功能
- v1.3.0 (2024-03-01): 优化性能和缓存策略