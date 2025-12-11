/**
 * 增强版 Swagger 配置
 * 提供更详细的 API 文档、示例和错误说明
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

// API 基础信息
const apiInfo = {
  title: '中道商城系统 API 文档',
  version: '1.0.0',
  description: `
    ## 📖 系统简介

    中道商城系统是一个多层级供应链社交电商平台，采用创新的商业模式，整合了社交电商、多级分销、会员体系等功能。

    ## 🎯 核心功能

    - **多级用户体系**: 从普通会员到董事的8级晋升体系
    - **双店铺模式**: 云店（业绩升级）和梧桐店（特殊权益）
    - **通券经济**: 内部虚拟货币，支持转账、购物、提现
    - **佣金系统**: 多级佣金分配，激励团队发展
    - **供应链管理**: 多仓库库存管理，智能物流

    ## 🔐 认证方式

    ### Bearer Token 认证
    \`\`\`http
    Authorization: Bearer <your_jwt_token>
    \`\`\`

    ### 获取 Token
    1. 微信小程序登录: \`POST /auth/wechat-login\`
    2. 手机号登录: \`POST /auth/phone-login\`
    3. 管理员登录: \`POST /admin/auth/login\`

    ## 📝 通用响应格式

    ### 成功响应
    \`\`\`json
    {
      "success": true,
      "data": {}, // 响应数据
      "message": "操作成功",
      "timestamp": "2025-11-24T10:30:00.000Z"
    }
    \`\`\`

    ### 错误响应
    \`\`\`json
    {
      "success": false,
      "error": {
        "code": "ERROR_CODE",
        "message": "错误描述",
        "details": {} // 详细错误信息（可选）
      },
      "timestamp": "2025-11-24T10:30:00.000Z"
    }
    \`\`\`

    ## 🚨 常见错误码

    | 错误码 | HTTP状态码 | 说明 |
    |--------|-----------|------|
    | TOKEN_EXPIRED | 401 | Token已过期 |
    | INVALID_TOKEN | 401 | Token无效 |
    | INSUFFICIENT_PERMISSIONS | 403 | 权限不足 |
    | INSUFFICIENT_BALANCE | 400 | 通券余额不足 |
    | USER_NOT_FOUND | 404 | 用户不存在 |
    | SHOP_NOT_EXIST | 404 | 店铺不存在 |
    | ORDER_NOT_FOUND | 404 | 订单不存在 |

    ## 📊 分页参数

    列表接口支持分页，使用以下参数：

    | 参数 | 类型 | 默认值 | 说明 |
    |------|------|--------|------|
    | page | number | 1 | 页码 |
    | pageSize/perPage | number | 20 | 每页数量（1-100） |

    分页响应格式：
    \`\`\`json
    {
      "items": [], // 数据列表
      "pagination": {
        "page": 1,
        "pageSize": 20,
        "total": 100,
        "totalPages": 5
      }
    }
    \`\`\`

    ## 🔍 搜索和筛选

    列表接口支持搜索和筛选：

    | 参数 | 类型 | 说明 |
    |------|------|------|
    | search | string | 搜索关键词 |
    | categoryId | string | 分类ID |
    | status | string | 状态筛选 |
    | startDate | string | 开始日期 (YYYY-MM-DD) |
    | endDate | string | 结束日期 (YYYY-MM-DD) |
    | sortBy | string | 排序字段 |
    | sortOrder | string | 排序方向 (asc/desc) |

    ## 🌍 环境

    | 环境 | URL | 说明 |
    |------|-----|------|
    | 开发环境 | http://localhost:3000/api/v1 | 本地开发 |
    | 测试环境 | https://test-api.zhongdao-mall.com/api/v1 | 测试验证 |
    | 生产环境 | https://api.zhongdao-mall.com/api/v1 | 正式环境 |

    ## 📞 技术支持

    - 开发团队: dev@zhongdao-mall.com
    - 问题反馈: https://github.com/zhongdao-mall/issues
    - 技术文档: https://docs.zhongdao-mall.com
  `,
  contact: {
    name: '中道商城开发团队',
    email: 'dev@zhongdao-mall.com',
    url: 'https://www.zhongdao-mall.com'
  },
  license: {
    name: 'MIT License',
    url: 'https://opensource.org/licenses/MIT'
  }
};

// 服务器配置
const servers = [
  {
    url: 'http://localhost:3000/api/v1',
    description: '开发环境',
    variables: {
      version: {
        default: 'v1',
        description: 'API版本'
      }
    }
  },
  {
    url: 'https://test-api.zhongdao-mall.com/api/v1',
    description: '测试环境'
  },
  {
    url: 'https://api.zhongdao-mall.com/api/v1',
    description: '生产环境'
  }
];

// 安全配置
const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT访问令牌，在请求头中携带: Authorization: Bearer <token>'
  },
  apiKey: {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
    description: 'API密钥（管理员接口使用）'
  }
};

// 通用参数定义
const commonParameters = {
  page: {
    name: 'page',
    in: 'query',
    description: '页码',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      default: 1
    }
  },
  pageSize: {
    name: 'pageSize',
    in: 'query',
    description: '每页数量',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20
    }
  },
  search: {
    name: 'search',
    in: 'query',
    description: '搜索关键词',
    required: false,
    schema: {
      type: 'string',
      maxLength: 100
    }
  },
  startDate: {
    name: 'startDate',
    in: 'query',
    description: '开始日期 (YYYY-MM-DD)',
    required: false,
    schema: {
      type: 'string',
      format: 'date'
    }
  },
  endDate: {
    name: 'endDate',
    in: 'query',
    description: '结束日期 (YYYY-MM-DD)',
    required: false,
    schema: {
      type: 'string',
      format: 'date'
    }
  }
};

// 通用响应定义
const commonResponses = {
  200: {
    description: '操作成功',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/ApiResponse'
        }
      }
    }
  },
  400: {
    description: '请求参数错误',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/ErrorResponse'
        },
        examples: {
          invalidParams: {
            summary: '参数错误',
            value: {
              success: false,
              error: {
                code: 'INVALID_PARAMS',
                message: '请求参数错误',
                details: {
                  field: 'phone',
                  reason: '手机号格式不正确'
                }
              },
              timestamp: '2025-11-24T10:30:00.000Z'
            }
          }
        }
      }
    }
  },
  401: {
    description: '未认证或Token无效',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/ErrorResponse'
        },
        examples: {
          tokenExpired: {
            summary: 'Token过期',
            value: {
              success: false,
              error: {
                code: 'TOKEN_EXPIRED',
                message: '登录已过期，请重新登录'
              },
              timestamp: '2025-11-24T10:30:00.000Z'
            }
          }
        }
      }
    }
  },
  403: {
    description: '权限不足',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/ErrorResponse'
        }
      }
    }
  },
  404: {
    description: '资源不存在',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/ErrorResponse'
        }
      }
    }
  },
  429: {
    description: '请求过于频繁',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/ErrorResponse'
        }
      }
    }
  },
  500: {
    description: '服务器内部错误',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/ErrorResponse'
        }
      }
    }
  }
};

// 通用 Schema 定义
const commonSchemas = {
  // 基础响应
  ApiResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: '操作是否成功',
        example: true
      },
      data: {
        type: 'object',
        description: '响应数据'
      },
      message: {
        type: 'string',
        description: '响应消息',
        example: '操作成功'
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: '响应时间戳'
      }
    }
  },

  // 错误响应
  ErrorResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: '操作是否成功',
        example: false
      },
      error: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '错误代码',
            example: 'INVALID_PARAMS'
          },
          message: {
            type: 'string',
            description: '错误消息',
            example: '请求参数错误'
          },
          details: {
            type: 'object',
            description: '错误详情'
          }
        }
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: '响应时间戳'
      }
    }
  },

  // 分页信息
  Pagination: {
    type: 'object',
    properties: {
      page: {
        type: 'integer',
        description: '当前页码',
        example: 1
      },
      pageSize: {
        type: 'integer',
        description: '每页数量',
        example: 20
      },
      total: {
        type: 'integer',
        description: '总记录数',
        example: 100
      },
      totalPages: {
        type: 'integer',
        description: '总页数',
        example: 5
      },
      hasNext: {
        type: 'boolean',
        description: '是否有下一页',
        example: true
      },
      hasPrev: {
        type: 'boolean',
        description: '是否有上一页',
        example: false
      }
    }
  },

  // 用户基础信息
  UserBase: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: '用户ID',
        example: 'cmi1234567890abcdef'
      },
      nickname: {
        type: 'string',
        description: '用户昵称',
        example: '张三'
      },
      avatarUrl: {
        type: 'string',
        description: '头像URL',
        example: 'https://wx.qlogo.cn/...'
      },
      level: {
        type: 'string',
        enum: ['NORMAL', 'VIP', 'STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'],
        description: '用户等级',
        example: 'STAR_3'
      }
    }
  },

  // 用户详情
  UserProfile: {
    allOf: [
      { $ref: '#/components/schemas/UserBase' },
      {
        type: 'object',
        properties: {
          openid: {
            type: 'string',
            description: '微信OpenID',
            example: 'wx_1234567890abcdef'
          },
          phone: {
            type: 'string',
            description: '手机号',
            example: '138****1234'
          },
          teamPath: {
            type: 'string',
            description: '团队路径',
            example: 'root/user1/user2'
          },
          parentId: {
            type: 'string',
            description: '推荐人ID',
            nullable: true
          },
          isActive: {
            type: 'boolean',
            description: '是否激活',
            example: true
          },
          performance: {
            type: 'object',
            description: '业绩信息',
            properties: {
              directCount: {
                type: 'integer',
                description: '直推人数',
                example: 15
              },
              teamCount: {
                type: 'integer',
                description: '团队人数',
                example: 150
              },
              totalSales: {
                type: 'number',
                description: '总销售额',
                example: 100000.00
              }
            }
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: '注册时间'
          }
        }
      }
    ]
  },

  // 商品基础信息
  ProductBase: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: '商品ID',
        example: 'cmp1234567890abcdef'
      },
      name: {
        type: 'string',
        description: '商品名称',
        example: '中道口服液'
      },
      description: {
        type: 'string',
        description: '商品描述',
        example: '高品质保健产品'
      },
      basePrice: {
        type: 'number',
        format: 'float',
        description: '基础价格',
        example: 599.00
      },
      images: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: '商品图片列表'
      },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE', 'DRAFT'],
        description: '商品状态',
        example: 'ACTIVE'
      }
    }
  },

  // 订单基础信息
  OrderBase: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: '订单ID',
        example: 'cmo1234567890abcdef'
      },
      orderNo: {
        type: 'string',
        description: '订单号',
        example: 'ZD20251124001'
      },
      totalAmount: {
        type: 'number',
        format: 'float',
        description: '订单总金额',
        example: 1200.00
      },
      status: {
        type: 'string',
        enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
        description: '订单状态',
        example: 'CONFIRMED'
      },
      paymentMethod: {
        type: 'string',
        enum: ['WECHAT', 'ALIPAY', 'POINTS'],
        description: '支付方式',
        example: 'POINTS'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: '创建时间'
      }
    }
  },

  // 通券余额
  PointsBalance: {
    type: 'object',
    properties: {
      balance: {
        type: 'number',
        format: 'float',
        description: '可用余额',
        example: 12580.50
      },
      frozenBalance: {
        type: 'number',
        format: 'float',
        description: '冻结余额',
        example: 500.00
      },
      totalIncome: {
        type: 'number',
        format: 'float',
        description: '累计收入',
        example: 50000.00
      },
      totalExpense: {
        type: 'number',
        format: 'float',
        description: '累计支出',
        example: 37419.50
      },
      lastUpdated: {
        type: 'string',
        format: 'date-time',
        description: '最后更新时间'
      }
    }
  },

  // 佣金信息
  CommissionInfo: {
    type: 'object',
    properties: {
      totalCommission: {
        type: 'number',
        format: 'float',
        description: '总佣金',
        example: 25000.00
      },
      pendingCommission: {
        type: 'number',
        format: 'float',
        description: '待结算佣金',
        example: 3500.00
      },
      settledCommission: {
        type: 'number',
        format: 'float',
        description: '已结算佣金',
        example: 21500.00
      },
      commissionRate: {
        type: 'number',
        description: '佣金比例',
        example: 0.12
      }
    }
  }
};

// Swagger 配置
const options = {
  definition: {
    openapi: '3.0.0',
    info: apiInfo,
    servers,
    components: {
      securitySchemes,
      schemas: {
        ...commonSchemas,
        // 业务相关 Schema 可以在这里添加
        User: { $ref: '#/components/schemas/UserProfile' },
        Product: { $ref: '#/components/schemas/ProductBase' },
        Order: { $ref: '#/components/schemas/OrderBase' },
        PointsBalance: { $ref: '#/components/schemas/PointsBalance' },
        CommissionInfo: { $ref: '#/components/schemas/CommissionInfo' }
      },
      parameters: commonParameters,
      responses: commonResponses
    },
    tags: [
      {
        name: 'Authentication',
        description: '认证相关接口'
      },
      {
        name: 'Users',
        description: '用户管理接口'
      },
      {
        name: 'Teams',
        description: '团队管理接口'
      },
      {
        name: 'Products',
        description: '商品管理接口'
      },
      {
        name: 'Orders',
        description: '订单管理接口'
      },
      {
        name: 'Shops',
        description: '店铺管理接口'
      },
      {
        name: 'Points',
        description: '通券管理接口'
      },
      {
        name: 'Commission',
        description: '佣金管理接口'
      },
      {
        name: 'Admin',
        description: '管理员接口'
      }
    ]
  },
  apis: [
    './src/routes/v1/**/*.ts',
    './src/modules/**/*.ts',
    './src/examples/swagger-enhanced-examples.ts'
  ]
};

// 生成 Swagger 文档
const specs = swaggerJsdoc(options);

// 自定义 Swagger UI 配置
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar {
      display: none;
    }
    .swagger-ui .info .title {
      color: #1890ff;
      font-size: 32px;
    }
    .swagger-ui .scheme-container {
      background: #fafafa;
      border-radius: 4px;
      padding: 10px;
    }
    .swagger-ui .opblock.opblock-post {
      border-color: #52c41a;
    }
    .swagger-ui .opblock.opblock-post .opblock-summary {
      border-color: #52c41a;
    }
    .swagger-ui .opblock.opblock-get {
      border-color: #1890ff;
    }
    .swagger-ui .opblock.opblock-get .opblock-summary {
      border-color: #1890ff;
    }
    .swagger-ui .opblock.opblock-put {
      border-color: #fa8c16;
    }
    .swagger-ui .opblock.opblock-put .opblock-summary {
      border-color: #fa8c16;
    }
    .swagger-ui .opblock.opblock-delete {
      border-color: #f5222d;
    }
    .swagger-ui .opblock.opblock-delete .opblock-summary {
      border-color: #f5222d;
    }
    .swagger-ui .btn.authorize {
      background: #1890ff;
    }
    .swagger-ui .topbar .download-url-wrapper .select-label {
      color: #1890ff;
    }
  `,
  customSiteTitle: '中道商城系统 API 文档',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    docExpansion: 'none',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
  }
};

// 设置 Swagger
export const setupSwagger = (app: Express) => {
  // API 文档路由
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));

  // 提供 JSON 格式的 API 文档
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // 重定向根路径到文档
  app.get('/docs', (req, res) => {
    res.redirect('/api-docs');
  });

  console.log('📚 Swagger API 文档已启动: http://localhost:3000/api-docs');
  console.log('📄 API 文档 JSON: http://localhost:3000/api-docs.json');
};

export default setupSwagger;