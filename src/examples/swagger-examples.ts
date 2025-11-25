/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: 认证相关接口
 *
 *   - name: Users
 *     description: 用户管理接口
 *
 *   - name: Products
 *     description: 商品管理接口
 */

/**
 * @swagger
 * /auth/wechat-login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: 微信小程序登录
 *     description: |
 *       通过微信授权码进行用户登录，支持新用户自动注册和已有用户登录。
 *
 *       ## 登录流程
 *       1. 小程序获取微信授权码
 *       2. 调用此接口进行登录
 *       3. 返回JWT Token和用户信息
 *
 *       ## 等级体系
 *       - **NORMAL**: 普通会员
 *       - **VIP**: VIP会员（首单≥599元）
 *       - **STAR_1-5**: 1-5星级店长
 *       - **DIRECTOR**: 董事
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
 *                 properties:
 *                   nickname:
 *                     type: string
 *                     description: 用户昵称
 *                     example: "张三"
 *                   avatarUrl:
 *                     type: string
 *                     description: 头像URL
 *                     example: "https://wx.qlogo.cn/mmopen/xxx"
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
 *                           type: string
 *                           description: JWT访问令牌
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                         refreshToken:
 *                           type: string
 *                           description: 刷新令牌
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *                         isNewUser:
 *                           type: boolean
 *                           description: 是否为新用户
 *                           example: false
 *                         needPhoneAuth:
 *                           type: boolean
 *                           description: 是否需要手机号认证
 *                           example: true
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
 *                 message: "微信认证失败"
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags:
 *       - Users
 *     summary: 获取当前用户信息
 *     description: |
 *       获取当前登录用户的详细信息，包括：
 *       - 基本信息（昵称、头像、手机号）
 *       - 等级信息和权益
 *       - 团队信息（推荐人、团队路径）
 *       - 统计数据（直推人数、团队人数、总业绩）
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
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /products:
 *   get:
 *     tags:
 *       - Products
 *     summary: 获取商品列表
 *     description: |
 *       获取商品列表，支持分页和筛选。
 *
 *       ## 价格体系
 *       不同等级用户享受不同进货折扣：
 *       - **普通会员**: 无折扣
 *       - **VIP**: 5折优惠
 *       - **一星店长**: 4折
 *       - **二星店长**: 3.5折
 *       - **三星店长**: 3折
 *       - **四星店长**: 2.6折
 *       - **五星店长**: 2.4折
 *       - **董事**: 2.2折
 *
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 每页数量
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: 分类ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, DRAFT]
 *           default: ACTIVE
 *         description: 商品状态
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索关键词
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
 *                             $ref: '#/components/schemas/Product'
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             page:
 *                               type: integer
 *                               example: 1
 *                             perPage:
 *                               type: integer
 *                               example: 20
 *                             total:
 *                               type: integer
 *                               example: 156
 *                             totalPages:
 *                               type: integer
 *                               example: 8
 */

/**
 * @swagger
 * /points/balance:
 *   get:
 *     tags:
 *       - Points
 *     summary: 获取通券余额
 *     description: |
 *       获取用户的通券余额和相关信息。
 *
 *       ## 通券来源
 *       - **下级采购**: 下级支付通券给上级（主要来源）
 *       - **直推奖励**: 直推成员采购时的固定奖励
 *       - **平台充值**: 五星/董事专属权益
 *       - **用户转账**: 用户间通券流转
 *
 *       ## 使用场景
 *       - 进货支付
 *       - 用户间转账
 *       - 平台服务费
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
 *                         balance:
 *                           type: number
 *                           format: float
 *                           description: 通券余额
 *                           example: 12580.50
 *                         frozenBalance:
 *                           type: number
 *                           format: float
 *                           description: 冻结余额
 *                           example: 500.00
 *                         totalIncome:
 *                           type: number
 *                           format: float
 *                           description: 累计收入
 *                           example: 50000.00
 *                         totalExpense:
 *                           type: number
 *                           format: float
 *                           description: 累计支出
 *                           example: 37419.50
 *                         lastUpdated:
 *                           type: string
 *                           format: date-time
 *                           description: 最后更新时间
 *                           example: "2025-11-24T03:06:00.000Z"
 */

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
 *       - 所有店长均可进行通券转账
 *       - 转账需要验证收款方用户存在
 *       - 单笔转账最低金额：1通券
 *       - 单笔转账最高金额：10000通券
 *       - 每日转账次数限制：50次
 *
 *       ## 手续费
 *       - 平台内转账：免费
 *       - 跨平台转账：1%手续费
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
 *                           example: "TXN202511240001"
 *                         fromUserId:
 *                           type: string
 *                           description: 付款方用户ID
 *                         toUserId:
 *                           type: string
 *                           description: 收款方用户ID
 *                         amount:
 *                           type: number
 *                           format: float
 *                           description: 转账金额
 *                         fee:
 *                           type: number
 *                           format: float
 *                           description: 手续费
 *                           example: 0.00
 *                         balance:
 *                           type: number
 *                           format: float
 *                           description: 转账后余额
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: 参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               insufficient_balance:
 *                 summary: 余额不足
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "INSUFFICIENT_BALANCE"
 *                     message: "通券余额不足"
 *               invalid_amount:
 *                 summary: 金额无效
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "INVALID_AMOUNT"
 *                     message: "转账金额必须在1-10000之间"
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

export {};