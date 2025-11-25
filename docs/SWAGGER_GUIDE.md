# Swagger API 文档使用指南

## 📖 概述

中道商城系统集成了 Swagger UI，提供交互式的 API 文档。开发者可以在浏览器中直接测试 API 接口，查看详细的请求/响应格式。

## 🚀 快速开始

### 1. 启动服务

```bash
# 启动后端服务
npm run dev

# 服务启动后，访问以下地址
# 📚 API 文档: http://localhost:3000/api-docs
# 📄 JSON 文档: http://localhost:3000/api-docs.json
```

### 2. 便捷命令

```bash
# 在浏览器中打开 API 文档
npm run docs:open

# 导出 JSON 格式的 API 文档
npm run docs:json
```

## 🔐 认证配置

Swagger 文档支持 JWT 认证，配置步骤如下：

### 1. 获取测试 Token

```bash
# 使用测试 Token（用于开发环境）
# Token 已预配置在 Swagger UI 中
```

### 2. 配置认证

1. 打开 API 文档页面：http://localhost:3000/api-docs
2. 点击右上角的 **"Authorize"** 按钮
3. 在弹出的对话框中输入 JWT Token：
   ```
   Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. 点击 **"Authorize"** 完成认证
5. 关闭对话框，现在可以测试需要认证的接口

## 📚 API 分类

### 核心业务模块

| 分类 | 描述 | 主要接口 |
|------|------|----------|
| **Authentication** | 认证授权 | 微信登录、Token刷新、退出登录 |
| **Users** | 用户管理 | 用户信息、等级升级、团队管理 |
| **Products** | 商品管理 | 商品列表、分类管理、标签管理 |
| **Orders** | 订单管理 | 订单创建、状态更新、订单查询 |
| **Payments** | 支付管理 | 支付处理、充值记录、支付统计 |
| **Points** | 通券管理 | 余额查询、通券转账、交易记录 |
| **Shops** | 店铺管理 | 店铺申请、等级升级、业绩统计 |
| **Inventory** | 库存管理 | 库存查询、调拨记录、预警管理 |
| **Teams** | 团队管理 | 团队结构、推荐关系、业绩统计 |
| **Commission** | 佣金管理 | 佣金计算、结算记录、统计分析 |
| **Admin** | 管理功能 | 系统配置、用户管理、权限控制 |

### 权限说明

- **🔓 公开接口**: 无需认证即可访问
- **👤 用户接口**: 需要用户登录
- **👨‍💼 管理员接口**: 需要管理员权限
- **👑 董事接口**: 需要董事级别权限

## 🧪 API 测试

### 1. 测试认证接口

```bash
# 1. 微信登录
POST /api/v1/auth/wechat-login
{
  "code": "071JG0000Zz1AW1R2B10009gQXx1JG0t",
  "userInfo": {
    "nickname": "张三",
    "avatarUrl": "https://wx.qlogo.cn/mmopen/xxx"
  }
}

# 2. 获取用户信息
GET /api/v1/users/me
Authorization: Bearer <your_jwt_token>
```

### 2. 测试商品接口

```bash
# 1. 获取商品列表
GET /api/v1/products?page=1&perPage=10&status=ACTIVE
Authorization: Bearer <your_jwt_token>

# 2. 获取商品详情
GET /api/v1/products/{product_id}
Authorization: Bearer <your_jwt_token>
```

### 3. 测试通券接口

```bash
# 1. 获取通券余额
GET /api/v1/points/balance
Authorization: Bearer <your_jwt_token>

# 2. 通券转账
POST /api/v1/points/transfer
{
  "toUserId": "cmi4n337o0001edbcfwcx3rydn",
  "amount": 100.50,
  "note": "进货结算"
}
Authorization: Bearer <your_jwt_token>
```

## 📝 API 注解规范

### 基础注解结构

```typescript
/**
 * @swagger
 * /api-endpoint:
 *   method:
 *     tags:
 *       - TagName
 *     summary: 接口简短描述
 *     description: |
 *       详细的接口描述，支持 Markdown 格式
 *
 *       ## 业务说明
 *       详细描述业务逻辑和使用场景
 *
 *       ## 参数说明
 *       说明重要参数的含义和约束
 *
 *     security: []  # 无需认证
 *     # 或
 *     security:
 *       - bearerAuth: []  # 需要 JWT 认证
 *
 *     parameters:
 *       - in: query|path|header
 *         name: parameterName
 *         schema:
 *           type: string|number|boolean
 *           enum: [value1, value2]  # 枚举值
 *           default: defaultValue    # 默认值
 *         description: 参数描述
 *         required: true|false
 *         example: 示例值
 *
 *     requestBody:
 *       required: true|false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field1, field2]
 *             properties:
 *               fieldName:
 *                 type: string|number|boolean|array|object
 *                 description: 字段描述
 *                 example: 示例值
 *                 enum: [value1, value2]  # 枚举值
 *
 *     responses:
 *       200:
 *         description: 成功响应
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         # 响应数据结构
 *       400:
 *         description: 参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               error_key:
 *                 summary: 错误描述
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "ERROR_CODE"
 *                     message: "错误信息"
 */
```

### 复杂数据结构

```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     CustomResponse:
 *       type: object
 *       required:
 *         - id
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           description: 唯一标识
 *           example: "cmi1234567890abcdef"
 *         name:
 *           type: string
 *           description: 名称
 *           example: "示例名称"
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, PENDING]
 *           description: 状态
 *           default: ACTIVE
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         metadata:
 *           type: object
 *           description: 扩展数据
 *           additionalProperties: true
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Item'
 */
```

## 🔧 自定义配置

### 1. 修改 Swagger UI 样式

编辑 `src/config/swagger.ts` 文件中的 `swaggerUiOptions`：

```typescript
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title {
      color: #1890ff;
      font-size: 32px;
    }
    .swagger-ui .scheme-container {
      background: #fafafa;
      border-radius: 8px;
    }
  `,
  customSiteTitle: '中道商城系统 API 文档',
  customfavIcon: '/favicon.ico',
};
```

### 2. 添加服务器环境

```typescript
servers: [
  {
    url: 'http://localhost:3000/api/v1',
    description: '开发环境',
  },
  {
    url: 'https://test-api.zhongdao-mall.com/api/v1',
    description: '测试环境',
  },
  {
    url: 'https://api.zhongdao-mall.com/api/v1',
    description: '生产环境',
  },
],
```

### 3. 更新数据模型

在 `components.schemas` 中添加新的数据模型：

```typescript
components: {
  schemas: {
    NewModel: {
      type: 'object',
      properties: {
        // 定义模型结构
      },
    },
  },
},
```

## 📚 最佳实践

### 1. 文档规范

- **接口描述要详细**: 包含业务逻辑、使用场景、约束条件
- **参数说明要完整**: 类型、格式、约束、示例都要说明
- **响应示例要真实**: 提供真实的业务数据和场景
- **错误码要统一**: 使用统一的错误码和错误信息

### 2. 测试友好

- 提供完整的测试数据
- 包含各种场景的响应示例
- 认证配置要简单明了
- 接口依赖关系要清晰

### 3. 维护建议

- 代码变更时同步更新文档
- 定期检查文档的准确性
- 收集开发者反馈持续改进
- 保持文档与代码的一致性

## 🆘 故障排除

### 常见问题

1. **文档页面无法访问**
   - 检查后端服务是否启动
   - 确认端口配置正确
   - 查看浏览器控制台错误信息

2. **接口测试失败**
   - 检查 JWT Token 是否有效
   - 确认请求参数格式正确
   - 查看网络请求详情

3. **文档更新不及时**
   - 重启后端服务重新生成文档
   - 检查代码注释格式是否正确
   - 清除浏览器缓存

### 调试技巧

```bash
# 查看 Swagger JSON 是否正常
curl http://localhost:3000/api-docs.json | jq .

# 检查特定接口的文档
curl http://localhost:3000/api-docs.json | jq '.paths."/api/v1/users/me"'
```

## 📞 技术支持

如果在使用过程中遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查浏览器控制台的错误信息
3. 联系开发团队获取支持

---

*最后更新: 2025-11-24*