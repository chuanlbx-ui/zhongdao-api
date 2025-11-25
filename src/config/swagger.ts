import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '中道商城系统 API',
      version: '1.0.0',
      description: `
        中道商城系统后端API文档

        ## 系统概述
        中道商城系统是一个多层级供应链社交电商平台，包含以下核心功能：

        ### 🎯 核心业务模块
        - **用户管理**: 多级用户体系（普通会员 → VIP → 1-5星店长 → 董事）
        - **双店铺系统**: 云店（业绩累积升级）+ 五通店（特殊权益）
        - **复杂采购规则**: 层级限制 + 中间人业绩 + 平级奖励
        - **双仓库存**: 云仓（团队共享）+ 本地仓（个人独有）
        - **通券流转**: 多源通券循环系统（进货+转账+充值）

        ### 🔐 认证方式
        - **Bearer Token**: JWT认证，在请求头中添加 \`Authorization: Bearer <token>\`
        - **CSRF保护**: 部分接口需要CSRF令牌

        ### 📱 响应格式
        所有API响应都遵循统一格式：
        \`\`\`json
        {
          "success": true,
          "data": {},
          "message": "操作成功",
          "timestamp": "2025-11-24T00:00:00.000Z"
        }
        \`\`\`

        ### 🔒 权限说明
        - **公开接口**: 无需认证即可访问
        - **用户接口**: 需要用户登录
        - **管理员接口**: 需要管理员权限
        - **董事接口**: 需要董事级别权限
      `,
      contact: {
        name: '中道商城开发团队',
        email: 'dev@zhongdao-mall.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: '开发环境',
      },
      {
        url: 'https://api.zhongdao-mall.com/api/v1',
        description: '生产环境',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT认证令牌',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '用户ID',
              example: 'cmi1234567890abcdef',
            },
            openid: {
              type: 'string',
              description: '微信OpenID',
              example: 'wx_1234567890abcdef',
            },
            nickname: {
              type: 'string',
              description: '用户昵称',
              example: '张三',
            },
            avatarUrl: {
              type: 'string',
              description: '头像URL',
              example: 'https://example.com/avatar.jpg',
            },
            phone: {
              type: 'string',
              description: '手机号',
              example: '13800138000',
            },
            level: {
              type: 'string',
              enum: ['NORMAL', 'VIP', 'STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'],
              description: '用户等级',
              example: 'STAR_3',
            },
            teamPath: {
              type: 'string',
              description: '团队路径',
              example: 'root/user1/user2',
            },
            parentId: {
              type: 'string',
              description: '推荐人ID',
              nullable: true,
            },
            isActive: {
              type: 'boolean',
              description: '是否激活',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: '创建时间',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: '更新时间',
            },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '商品ID',
            },
            name: {
              type: 'string',
              description: '商品名称',
              example: '中道口服液',
            },
            description: {
              type: 'string',
              description: '商品描述',
              example: '高品质保健产品，每盒10支',
            },
            basePrice: {
              type: 'number',
              format: 'float',
              description: '基础价格',
              example: 599.00,
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: '商品图片列表',
            },
            categoryId: {
              type: 'string',
              description: '分类ID',
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: '商品标签',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'DRAFT'],
              description: '商品状态',
            },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '订单ID',
            },
            orderNo: {
              type: 'string',
              description: '订单号',
              example: 'ZD20251124001',
            },
            userId: {
              type: 'string',
              description: '用户ID',
            },
            items: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/OrderItem',
              },
              description: '订单项目',
            },
            totalAmount: {
              type: 'number',
              format: 'float',
              description: '订单总金额',
              example: 1200.00,
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
              description: '订单状态',
            },
            paymentMethod: {
              type: 'string',
              enum: ['WECHAT', 'ALIPAY', 'POINTS'],
              description: '支付方式',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: '创建时间',
            },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            productId: {
              type: 'string',
              description: '商品ID',
            },
            specId: {
              type: 'string',
              description: '规格ID',
            },
            quantity: {
              type: 'integer',
              minimum: 1,
              description: '数量',
              example: 2,
            },
            price: {
              type: 'number',
              format: 'float',
              description: '单价',
              example: 599.00,
            },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: '操作是否成功',
            },
            data: {
              type: 'object',
              description: '响应数据',
            },
            message: {
              type: 'string',
              description: '响应消息',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: '响应时间戳',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: '错误代码',
                },
                message: {
                  type: 'string',
                  description: '错误消息',
                },
              },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: '认证相关接口',
      },
      {
        name: 'Users',
        description: '用户管理接口',
      },
      {
        name: 'Products',
        description: '商品管理接口',
      },
      {
        name: 'Orders',
        description: '订单管理接口',
      },
      {
        name: 'Payments',
        description: '支付相关接口',
      },
      {
        name: 'Points',
        description: '通券管理接口',
      },
      {
        name: 'Shops',
        description: '店铺管理接口',
      },
      {
        name: 'Inventory',
        description: '库存管理接口',
      },
      {
        name: 'Teams',
        description: '团队管理接口',
      },
      {
        name: 'Commission',
        description: '佣金管理接口',
      },
      {
        name: 'Admin',
        description: '管理员接口',
      },
    ],
  },
  apis: ['./src/routes/v1/*.ts', './src/modules/**/*.ts'], // 扫描的文件路径
};

const specs = swaggerJsdoc(options);

export const swaggerSetup = (app: Express) => {
  // Swagger UI 配置
  const swaggerUiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #1890ff }
      .swagger-ui .scheme-container { background: #fafafa }
      .swagger-ui .opblock.opblock-post { border-color: #52c41a }
      .swagger-ui .opblock.opblock-get { border-color: #1890ff }
      .swagger-ui .opblock.opblock-put { border-color: #fa8c16 }
      .swagger-ui .opblock.opblock-delete { border-color: #f5222d }
    `,
    customSiteTitle: '中道商城系统 API 文档',
    customfavIcon: '/favicon.ico',
  };

  // API 文档路由
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));

  // 提供JSON格式的API文档
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log('📚 Swagger API 文档已启动: http://localhost:3000/api-docs');
};

export default swaggerSetup;