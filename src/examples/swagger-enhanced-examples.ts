/**
 * 增强版 Swagger 示例
 * 提供详细的 API 使用示例和业务场景说明
 */

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: 用户认证接口，包括登录、注册、Token管理等功能
 *
 *   - name: Users
 *     description: 用户管理接口，包括用户信息、等级管理、权限控制等
 *
 *   - name: Teams
 *     description: 团队管理接口，包括团队结构、业绩统计、下级管理等
 *
 *   - name: Products
 *     description: 商品管理接口，包括商品列表、详情、分类管理等
 *
 *   - name: Orders
 *     description: 订单管理接口，包括订单创建、查询、状态更新等
 *
 *   - name: Shops
 *     description: 店铺管理接口，包括云店、梧桐店的管理和运营
 *
 *   - name: Points
 *     description: 通券（积分）管理接口，包括余额、转账、交易记录等
 *
 *   - name: Commission
 *     description: 佣金管理接口，包括佣金统计、明细、提现等
 */

// ========== 认证相关接口示例 ==========

/**
 * @swagger
 * /auth/wechat-login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: 微信小程序登录
 *     description: |
 *       微信小程序用户登录接口，支持自动注册和登录。
 *
 *       ## 登录流程
 *       1. 小程序调用 wx.login() 获取 code
 *       2. 调用 wx.getUserProfile() 获取用户信息
 *       3. 将 code 和 userInfo 提交到本接口
 *       4. 服务器验证 code 并返回 JWT Token
 *
 *       ## 用户等级说明
 *       - **NORMAL**: 普通会员，无特殊权限
 *       - **VIP**: VIP会员，享受5折进货优惠
 *       - **STAR_1-5**: 1-5星级店长，享受递增佣金比例
 *       - **DIRECTOR**: 董事，享受最高权益
 *
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: 微信授权码
 *                 example: "071JG0000Zz1AW1R2B10009gQXx1JG0t"
 *               userInfo:
 *                 type: object
 *                 description: 用户信息
 *                 properties:
 *                   nickname:
 *                     type: string
 *                     description: 用户昵称
 *                     example: "张三"
 *                   avatarUrl:
 *                     type: string
 *                     description: 头像URL
 *                     example: "https://wx.qlogo.cn/mmopen/vi_32/..."
 *                   gender:
 *                     type: integer
 *                     description: 性别（0-未知，1-男，2-女）
 *                     example: 1
 *                   country:
 *                     type: string
 *                     description: 国家
 *                     example: "中国"
 *                   province:
 *                     type: string
 *                     description: 省份
 *                     example: "广东省"
 *                   city:
 *                     type: string
 *                     description: 城市
 *                     example: "深圳市"
 *     responses:
 *       200:
 *         description: 登录成功
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
 *                         token:
 *                           type: 'string'
 *                           description: JWT访问令牌，有效期2小时
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
 *                         refreshToken:
 *                           type: 'string'
 *                           description: 刷新令牌，有效期7天
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
 *                         user:
 *                           $ref: '#/components/schemas/UserProfile'
 *                         isNewUser:
 *                           type: boolean
 *                           description: 是否为新用户
 *                           example: false
 *                         needPhoneAuth:
 *                           type: boolean
 *                           description: 是否需要绑定手机号
 *                           example: true
 *                         expireIn:
 *                           type: integer
 *                           description: Token过期时间（秒）
 *                           example: 7200
 *             examples:
 *               existingUser:
 *                 summary: 老用户登录
 *                 value:
 *                   success: true
 *                   data:
 *                     token: "eyJhbGciOiJIUzI1NiIs..."
 *                     refreshToken: "eyJhbGciOiJIUzI1NiIs..."
 *                     user:
 *                       id: "cmi1234567890abcdef"
 *                       nickname: "张三"
 *                       level: "STAR_3"
 *                       phone: "138****1234"
 *                     isNewUser: false
 *                     needPhoneAuth: false
 *                   message: "登录成功"
 *               newUser:
 *                 summary: 新用户自动注册
 *                 value:
 *                   success: true
 *                   data:
 *                     token: "eyJhbGciOiJIUzI1NiIs..."
 *                     refreshToken: "eyJhbGciOiJIUzI1NiIs..."
 *                     user:
 *                       id: "cmi1234567890abcdef"
 *                       nickname: "新用户"
 *                       level: "NORMAL"
 *                       phone: null
 *                     isNewUser: true
 *                     needPhoneAuth: true
 *                   message: "注册并登录成功"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "INVALID_CODE"
 *                 message: "微信授权码无效或已过期"
 *               timestamp: "2025-11-24T10:30:00.000Z"
 *       401:
 *         description: 微信认证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "WECHAT_AUTH_FAILED"
 *                 message: "微信服务器认证失败"
 *               timestamp: "2025-11-24T10:30:00.000Z"
 */

// ========== 用户管理接口示例 ==========

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags:
 *       - Users
 *     summary: 获取当前用户信息
 *     description: |
 *       获取当前登录用户的详细信息，包括：
 *       - 基础信息（昵称、头像、手机号）
 *       - 等级信息和进度
 *       - 团队信息和路径
 *       - 业绩统计数据
 *       - 权限列表
 *
 *       ## 返回数据说明
 *       - performance: 用户业绩数据，包括直推人数、团队人数等
 *       - teamPath: 团队路径，用于快速查询上下级关系
 *       - permissions: 用户权限列表，用于前端权限控制
 *
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserProfile'
 *             example:
 *               success: true
 *               data:
 *                 id: "cmi1234567890abcdef"
 *                 openid: "wx_1234567890abcdef"
 *                 nickname: "张三"
 *                 avatarUrl: "https://wx.qlogo.cn/..."
 *                 phone: "13800138000"
 *                 level: "STAR_3"
 *                 teamPath: "root/user1/user2"
 *                 parentId: "cmi1234567890abcddd"
 *                 isActive: true
 *                 performance:
 *                   directCount: 15
 *                   teamCount: 150
 *                   totalSales: 100000.00
 *                   monthlySales: 12000.00
 *                 permissions:
 *                   - "VIEW_PRODUCTS"
 *                   - "PLACE_ORDER"
 *                   - "VIEW_TEAM"
 *                   - "COMMISSION_WITHDRAW"
 *                 createdAt: "2025-10-01T10:30:00.000Z"
 *               message: "获取成功"
 */

/**
 * @swagger
 * /users/level-info:
 *   get:
 *     tags:
 *       - Users
 *     summary: 获取用户等级信息
 *     description: |
 *       获取用户当前等级信息和升级进度，包括：
 *       - 当前等级权益
 *       - 升级进度统计
 *       - 下一等级要求
 *       - 权限列表
 *
 *       ## 等级升级要求
 *       - 直推VIP数量：直接推荐的VIP会员数量
 *       - 团队规模：包括所有下级的总人数
 *       - 业绩要求：总销售额或月销售额要求
 *
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
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
 *                         currentLevel:
 *                           type: string
 *                           description: 当前等级
 *                           example: "STAR_3"
 *                         levelName:
 *                           type: string
 *                           description: 等级名称
 *                           example: "三星店长"
 *                         progress:
 *                           type: object
 *                           description: 升级进度
 *                           properties:
 *                             directVipCount:
 *                               type: integer
 *                               description: 当前直推VIP数
 *                               example: 15
 *                             requiredDirectVip:
 *                               type: integer
 *                               description: 升级所需直推VIP数
 *                               example: 15
 *                             teamSize:
 *                               type: integer
 *                               description: 当前团队人数
 *                               example: 150
 *                             requiredTeamSize:
 *                               type: integer
 *                               description: 升级所需团队人数
 *                               example: 150
 *                             percentage:
 *                               type: number
 *                               description: 进度百分比
 *                               example: 100
 *                             canUpgrade:
 *                               type: boolean
 *                               description: 是否可以升级
 *                               example: true
 *                         nextLevel:
 *                           type: object
 *                           description: 下一等级信息
 *                           properties:
 *                             level:
 *                               type: string
 *                               description: 下一等级代码
 *                               example: "STAR_4"
 *                             levelName:
 *                               type: string
 *                               description: 下一等级名称
 *                               example: "四星店长"
 *                             benefits:
 *                               type: object
 *                               properties:
 *                                 discount:
 *                                   type: number
 *                                   description: 进货折扣
 *                                   example: 0.74
 *                                 directCommission:
 *                                   type: number
 *                                   description: 直推佣金比例
 *                                   example: 0.16
 *                                 indirectCommission:
 *                                   type: number
 *                                   description: 间推佣金比例
 *                                   example: 0.05
 *                             requirements:
 *                               type: object
 *                               properties:
 *                                 directVip:
 *                                   type: integer
 *                                   description: 所需直推VIP数
 *                                   example: 25
 *                                 teamSize:
 *                                   type: integer
 *                                   description: 所需团队人数
 *                                   example: 500
 *                                 totalSales:
 *                                   type: number
 *                                   description: 所需总销售额
 *                                   example: 200000
 *                         privileges:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 权限列表
 *                           example:
 *                             - "VIEW_TEAM_STATS"
 *                             - "MANAGE_SUBORDINATES"
 *                             - "COMMISSION_WITHDRAW"
 */

// ========== 团队管理接口示例 ==========

/**
 * @swagger
 * /teams/structure:
 *   get:
 *     tags:
 *       - Teams
 *     summary: 获取团队结构
 *     description: |
 *       获取用户的团队树形结构，支持多级展开。
 *
 *       ## 返回数据说明
 *       - root: 根节点（当前用户）
 *       - children: 直接下级列表
 *       - 支持分页加载，避免数据量过大
 *
 *       ## 使用场景
 *       - 查看团队层级关系
 *       - 统计团队规模
 *       - 分析团队结构
 *
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/pageSize'
 *       - name: level
 *         in: query
 *         description: 展开层级（1-3级）
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 3
 *           default: 1
 *       - name: filter
 *         in: query
 *         description: 筛选条件
 *         required: false
 *         schema:
 *           type: string
 *           enum: [active, inactive, all]
 *           default: all
 *     responses:
 *       200:
 *         description: 获取成功
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
 *                         root:
 *                           $ref: '#/components/schemas/UserBase'
 *                         children:
 *                           type: array
 *                           items:
 *                             allOf:
 *                               - $ref: '#/components/schemas/UserBase'
 *                               - type: object
 *                                 properties:
 *                                   directCount:
 *                                     type: integer
 *                                     description: 直推人数
 *                                     example: 10
 *                                   teamCount:
 *                                     type: integer
 *                                     description: 团队人数
 *                                     example: 50
 *                                   children:
 *                                     type: array
 *                                     description: 下下级（仅当level > 1时返回）
 *                                     items:
 *                                       $ref: '#/components/schemas/UserBase'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 */

// ========== 商品管理接口示例 ==========

/**
 * @swagger
 * /products:
 *   get:
 *     tags:
 *       - Products
 *     summary: 获取商品列表
 *     description: |
 *       获取商品列表，支持多条件筛选和排序。
 *
 *       ## 价格体系说明
 *       不同等级用户享受不同的进货折扣：
 *       - **普通会员**: 无折扣
 *       - **VIP会员**: 5折优惠
 *       - **一星店长**: 4折
 *       - **二星店长**: 3.5折
 *       - **三星店长**: 3折
 *       - **四星店长**: 2.6折
 *       - **五星店长**: 2.4折
 *       - **董事**: 2.2折
 *
 *       ## 筛选说明
 *       - categoryId: 按分类筛选
 *       - status: 按状态筛选（active-上架, inactive-下架, draft-草稿）
 *       - search: 搜索商品名称和描述
 *       - sortBy: 排序字段（name, price, sales, createdAt）
 *       - sortOrder: 排序方向（asc-升序, desc-降序）
 *
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/pageSize'
 *       - $ref: '#/components/parameters/search'
 *       - name: categoryId
 *         in: query
 *         description: 商品分类ID
 *         required: false
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         description: 商品状态
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, DRAFT]
 *           default: ACTIVE
 *       - name: minPrice
 *         in: query
 *         description: 最低价格
 *         required: false
 *         schema:
 *           type: number
 *           minimum: 0
 *       - name: maxPrice
 *         in: query
 *         description: 最高价格
 *         required: false
 *         schema:
 *           type: number
 *           minimum: 0
 *       - name: sortBy
 *         in: query
 *         description: 排序字段
 *         required: false
 *         schema:
 *           type: string
 *           enum: [name, price, sales, createdAt]
 *           default: createdAt
 *       - name: sortOrder
 *         in: query
 *         description: 排序方向
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: 获取成功
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
 *                         items:
 *                           type: array
 *                           items:
 *                             allOf:
 *                               - $ref: '#/components/schemas/ProductBase'
 *                               - type: object
 *                                 properties:
 *                                   categoryId:
 *                                     type: string
 *                                     description: 分类ID
 *                                     example: "cat_1234567890"
 *                                   categoryName:
 *                                     type: string
 *                                     description: 分类名称
 *                                     example: "保健品"
 *                                   tags:
 *                                     type: array
 *                                     items:
 *                                       type: string
 *                                     description: 商品标签
 *                                     example: ["热销", "推荐"]
 *                                   specs:
 *                                     type: array
 *                                     items:
 *                                       type: object
 *                                       properties:
 *                                         id:
 *                                           type: string
 *                                           description: 规格ID
 *                                         name:
 *                                           type: string
 *                                           description: 规格名称
 *                                         price:
 *                                           type: number
 *                                           description: 价格
 *                                         stock:
 *                                           type: integer
 *                                           description: 库存
 *                                   sales:
 *                                     type: integer
 *                                     description: 销量
 *                                     example: 1234
 *                                   rating:
 *                                     type: number
 *                                     description: 评分
 *                                     example: 4.8
 *                                   userPrice:
 *                                     type: number
 *                                     description: 用户价格（根据等级计算）
 *                                     example: 299.50
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *                         filters:
 *                           type: object
 *                           description: 可用的筛选条件
 *                           properties:
 *                             categories:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                   name:
 *                                     type: string
 *                                   count:
 *                                     type: integer
 *                             tags:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             priceRanges:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   label:
 *                                     type: string
 *                                   min:
 *                                     type: number
 *                                   max:
 *                                     type: number
 *                                   count:
 *                                     type: integer
 */

// ========== 通券管理接口示例 ==========

/**
 * @swagger
 * /points/transfer:
 *   post:
 *     tags:
 *       - Points
 *     summary: 通券转账
 *     description: |
 *       向其他用户转账通券。
 *
 *       ## 转账规则
 *       - 发送方必须是店长级别（VIP及以上）
 *       - 单笔转账金额：1-10000通券
 *       - 每日转账次数限制：50次
 *       - 平台内转账免费
 *
 *       ## 安全说明
 *       - 需要验证交易密码
 *       - 超过限额需要人工审核
 *       - 异常转账会被风控拦截
 *
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toUserId
 *               - amount
 *               - note
 *               - password
 *             properties:
 *               toUserId:
 *                 type: string
 *                 description: 收款方用户ID
 *                 example: "cmi4n337o0001edbcfwcx3rydn"
 *               amount:
 *                 type: number
 *                 format: float
 *                 minimum: 1
 *                 maximum: 10000
 *                 description: 转账金额
 *                 example: 100.50
 *               note:
 *                 type: string
 *                 maxLength: 200
 *                 description: 转账备注
 *                 example: "进货结算"
 *               password:
 *                 type: string
 *                 description: 交易密码（6位数字）
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 转账成功
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
 *                         transactionId:
 *                           type: string
 *                           description: 交易流水号
 *                           example: "TXN20251124001"
 *                         fromUserId:
 *                           type: string
 *                           description: 付款方用户ID
 *                         toUserId:
 *                           type: string
 *                           description: 收款方用户ID
 *                         toUserInfo:
 *                           type: object
 *                           description: 收款方信息
 *                           properties:
 *                             nickname:
 *                               type: string
 *                               example: "李四"
 *                             avatarUrl:
 *                               type: string
 *                               example: "https://wx.qlogo.cn/..."
 *                         amount:
 *                           type: number
 *                           format: float
 *                           description: 转账金额
 *                           example: 100.50
 *                         fee:
 *                           type: number
 *                           format: float
 *                           description: 手续费
 *                           example: 0.00
 *                         actualAmount:
 *                           type: number
 *                           format: float
 *                           description: 实际到账金额
 *                           example: 100.50
 *                         balance:
 *                           type: number
 *                           format: float
 *                           description: 转账后余额
 *                           example: 11979.50
 *                         status:
 *                           type: string
 *                           description: 交易状态
 *                           example: "SUCCESS"
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                           description: 交易时间
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               insufficientBalance:
 *                 summary: 余额不足
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "INSUFFICIENT_BALANCE"
 *                     message: "通券余额不足"
 *               invalidAmount:
 *                 summary: 金额无效
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "INVALID_AMOUNT"
 *                     message: "转账金额必须在1-10000之间"
 *               dailyLimitExceeded:
 *                 summary: 超出每日限额
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "DAILY_LIMIT_EXCEEDED"
 *                     message: "今日转账次数已达上限"
 *       404:
 *         description: 收款方不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "USER_NOT_FOUND"
 *                 message: "收款方用户不存在"
 */

// ========== 店铺管理接口示例 ==========

/**
 * @swagger
 * /shops/open-cloud-shop:
 *   post:
 *     tags:
 *       - Shops
 *     summary: 开通云店
 *     description: |
 *       用户开通云店，成为店主。
 *
 *       ## 云店权益
 *       - 免费开通
 *       - 享受销售佣金
 *       - 拥有自己的店铺页面
 *       - 可以发展团队
 *
 *       ## 开通条件
 *       - 必须是VIP及以上等级
 *       - 完成实名认证
 *       - 同意店铺协议
 *
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shopName
 *               - agreement
 *             properties:
 *               shopName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 description: 店铺名称
 *                 example: "张三的云店"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: 店铺描述
 *                 example: "专业销售中道健康产品，品质保证"
 *               logo:
 *                 type: string
 *                 format: uri
 *                 description: 店铺Logo URL
 *                 example: "https://example.com/shop-logo.jpg"
 *               contactPhone:
 *                 type: string
 *                 pattern: '^1[3-9]\d{9}$'
 *                 description: 联系电话
 *                 example: "13800138000"
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 description: 联系邮箱
 *                 example: "shop@example.com"
 *               agreement:
 *                 type: boolean
 *                 description: 是否同意店铺协议
 *                 example: true
 *     responses:
 *       200:
 *         description: 开通成功
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
 *                         shopId:
 *                           type: string
 *                           description: 店铺ID
 *                           example: "cms1234567890abcdef"
 *                         shopName:
 *                           type: string
 *                           description: 店铺名称
 *                           example: "张三的云店"
 *                         shopUrl:
 *                           type: string
 *                           description: 店铺访问地址
 *                           example: "https://shop.zhongdao-mall.com/cm1234567890abcdef"
 *                         initialLevel:
 *                           type: integer
 *                           description: 初始店铺等级
 *                           example: 1
 *                         welcomeKit:
 *                           type: object
 *                           description: 新手礼包
 *                           properties:
 *                             inventoryAccess:
 *                               type: boolean
 *                               description: 是否有库存访问权限
 *                               example: true
 *                             productCatalog:
 *                               type: boolean
 *                               description: 是否有商品目录
 *                               example: true
 *                             salesTools:
 *                               type: boolean
 *                               description: 是否有销售工具
 *                               example: true
 *                             trainingMaterials:
 *                               type: boolean
 *                               description: 是否有培训资料
 *                               example: true
 *                         nextSteps:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 下一步操作指引
 *                           example:
 *                             - "完善店铺信息"
 *                             - "学习产品知识"
 *                             - "开始推广销售"
 *                             - "发展团队"
 */

export {};