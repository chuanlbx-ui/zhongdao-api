/**
 * 外部服务Mock工具
 * 模拟微信支付、微信登录等外部依赖服务
 */

import { Request, Response, NextFunction } from 'express';

// 测试环境标识
const IS_TEST_ENV = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

// Mock数据存储
const mockData = {
  wechatUsers: new Map<string, any>(),
  paymentOrders: new Map<string, any>(),
  smsCodes: new Map<string, { code: string; timestamp: number; attempts: number }>(),
  emailCodes: new Map<string, { code: string; timestamp: number; attempts: number }>()
};

/**
 * 微信服务Mock
 */
export class WechatServiceMock {
  /**
   * Mock微信登录
   */
  static mockLogin(code: string): {
    openid: string;
    unionid: string;
    nickname: string;
    headimgurl: string;
    session_key: string;
  } {
    // 根据code生成固定的mock用户信息
    const userId = code.substring(0, 8) || Math.random().toString(36).substring(2, 10);
    const openid = `test_openid_${userId}`;
    const unionid = `test_unionid_${userId}`;

    const userInfo = {
      openid,
      unionid,
      nickname: `测试用户_${userId}`,
      headimgurl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/test_avatar.png',
      session_key: `test_session_key_${Date.now()}`
    };

    // 存储mock数据
    mockData.wechatUsers.set(openid, userInfo);

    return userInfo;
  }

  /**
   * Mock微信支付
   */
  static mockPayment(orderData: any): {
    prepay_id: string;
    pay_sign: string;
    timestamp: string;
    nonce_str: string;
    package: string;
    sign_type: string;
  } {
    const prepayId = `test_prepay_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const nonceStr = Math.random().toString(36).substring(2);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const paymentData = {
      prepay_id: prepayId,
      pay_sign: `test_sign_${prepayId}`,
      timestamp,
      nonce_str: nonceStr,
      package: `prepay_id=${prepayId}`,
      sign_type: 'RSA'
    };

    // 存储mock订单数据
    mockData.paymentOrders.set(prepayId, {
      ...orderData,
      paymentData,
      status: 'pending',
      created_at: new Date()
    });

    return paymentData;
  }

  /**
   * Mock微信支付回调
   */
  static mockPaymentNotify(prepayId: string): {
    transaction_id: string;
    out_trade_no: string;
    result_code: string;
    total_fee: number;
    time_end: string;
  } {
    const order = mockData.paymentOrders.get(prepayId);
    if (!order) {
      throw new Error('Mock order not found');
    }

    const notifyData = {
      transaction_id: `test_transaction_${Date.now()}`,
      out_trade_no: order.order_no,
      result_code: 'SUCCESS',
      total_fee: Math.floor(order.amount * 100), // 转换为分
      time_end: new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14)
    };

    // 更新订单状态
    order.status = 'paid';
    order.notify_data = notifyData;
    order.paid_at = new Date();

    return notifyData;
  }
}

/**
 * 短信服务Mock
 */
export class SmsServiceMock {
  private static readonly CODE_EXPIRY = 5 * 60 * 1000; // 5分钟过期
  private static readonly MAX_ATTEMPTS = 3; // 最大尝试次数

  /**
   * 发送验证码
   */
  static sendSmsCode(phone: string): { success: boolean; code?: string; message?: string } {
    // 检查发送频率限制
    const existing = mockData.smsCodes.get(phone);
    if (existing && Date.now() - existing.timestamp < 60000) {
      return {
        success: false,
        message: '验证码发送过于频繁，请稍后再试'
      };
    }

    // 生成6位验证码（测试用固定验证码）
    const code = '123456'; // 测试环境使用固定验证码

    mockData.smsCodes.set(phone, {
      code,
      timestamp: Date.now(),
      attempts: 0
    });

    console.log(`📱 Mock短信发送: ${phone} -> ${code}`);

    return {
      success: true,
      code, // 测试环境返回验证码
      message: '验证码已发送'
    };
  }

  /**
   * 验证验证码
   */
  static verifySmsCode(phone: string, inputCode: string): { success: boolean; message?: string } {
    const stored = mockData.smsCodes.get(phone);
    if (!stored) {
      return {
        success: false,
        message: '验证码不存在或已过期'
      };
    }

    // 检查过期时间
    if (Date.now() - stored.timestamp > this.CODE_EXPIRY) {
      mockData.smsCodes.delete(phone);
      return {
        success: false,
        message: '验证码已过期'
      };
    }

    // 检查尝试次数
    if (stored.attempts >= this.MAX_ATTEMPTS) {
      mockData.smsCodes.delete(phone);
      return {
        success: false,
        message: '验证码错误次数过多，请重新获取'
      };
    }

    // 验证验证码
    stored.attempts++;
    if (inputCode === stored.code || (IS_TEST_ENV && inputCode === '123456')) {
      mockData.smsCodes.delete(phone);
      return {
        success: true,
        message: '验证码正确'
      };
    }

    return {
      success: false,
      message: `验证码错误，还剩${this.MAX_ATTEMPTS - stored.attempts}次机会`
    };
  }

  /**
   * 清理过期的验证码
   */
  static cleanupExpiredCodes(): void {
    const now = Date.now();
    for (const [phone, data] of mockData.smsCodes.entries()) {
      if (now - data.timestamp > this.CODE_EXPIRY) {
        mockData.smsCodes.delete(phone);
      }
    }
  }
}

/**
 * 邮件服务Mock
 */
export class EmailServiceMock {
  private static readonly CODE_EXPIRY = 10 * 60 * 1000; // 10分钟过期

  /**
   * 发送邮箱验证码
   */
  static sendEmailCode(email: string): { success: boolean; code?: string; message?: string } {
    // 生成6位验证码（测试用固定验证码）
    const code = '654321'; // 测试环境使用固定验证码

    mockData.emailCodes.set(email, {
      code,
      timestamp: Date.now(),
      attempts: 0
    });

    console.log(`📧 Mock邮件发送: ${email} -> ${code}`);

    return {
      success: true,
      code, // 测试环境返回验证码
      message: '验证码已发送到邮箱'
    };
  }

  /**
   * 验证邮箱验证码
   */
  static verifyEmailCode(email: string, inputCode: string): { success: boolean; message?: string } {
    const stored = mockData.emailCodes.get(email);
    if (!stored) {
      return {
        success: false,
        message: '验证码不存在或已过期'
      };
    }

    // 检查过期时间
    if (Date.now() - stored.timestamp > this.CODE_EXPIRY) {
      mockData.emailCodes.delete(email);
      return {
        success: false,
        message: '验证码已过期'
      };
    }

    // 验证验证码
    if (inputCode === stored.code || (IS_TEST_ENV && inputCode === '654321')) {
      mockData.emailCodes.delete(email);
      return {
        success: true,
        message: '验证码正确'
      };
    }

    return {
      success: false,
      message: '验证码错误'
    };
  }
}

/**
 * 支付服务Mock
 */
export class PaymentServiceMock {
  /**
   * Mock支付宝支付
   */
  static mockAlipayPayment(orderData: any): {
    order_string: string;
    out_trade_no: string;
  } {
    const orderString = `test_alipay_order_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    return {
      order_string: orderString,
      out_trade_no: orderData.order_no
    };
  }

  /**
   * Mock支付宝回调
   */
  static mockAlipayNotify(orderNo: string): {
    trade_no: string;
    out_trade_no: string;
    trade_status: string;
    total_amount: string;
    gmt_payment: string;
  } {
    return {
      trade_no: `test_alipay_trade_${Date.now()}`,
      out_trade_no: orderNo,
      trade_status: 'TRADE_SUCCESS',
      total_amount: '0.01', // 测试金额
      gmt_payment: new Date().toISOString()
    };
  }
}

/**
 * 物流服务Mock
 */
export class LogisticsServiceMock {
  /**
   * Mock物流查询
   */
  static mockLogisticsTracking(trackingNo: string): {
    status: string;
    traces: Array<{
      time: string;
      status: string;
      description: string;
    }>;
  } {
    return {
      status: 'DELIVERED',
      traces: [
        {
          time: '2024-01-01 10:00:00',
          status: 'PICKED_UP',
          description: '快件已被取件'
        },
        {
          time: '2024-01-01 14:00:00',
          status: 'IN_TRANSIT',
          description: '快件正在运输中'
        },
        {
          time: '2024-01-02 09:00:00',
          status: 'OUT_FOR_DELIVERY',
          description: '快件正在派送中'
        },
        {
          time: '2024-01-02 15:00:00',
          status: 'DELIVERED',
          description: '快件已签收'
        }
      ]
    };
  }
}

/**
 * Express中间件：Mock外部服务拦截
 */
export function mockExternalServicesMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!IS_TEST_ENV) {
    return next();
  }

  // 添加Mock标识头
  res.set('X-Mock-Services', 'true');

  // 拦截微信相关请求
  if (req.path.includes('/wechat')) {
    return handleWechatMock(req, res, next);
  }

  // 拦截支付相关请求
  if (req.path.includes('/payment')) {
    return handlePaymentMock(req, res, next);
  }

  // 拦截短信相关请求
  if (req.path.includes('/sms')) {
    return handleSmsMock(req, res, next);
  }

  // 拦截邮件相关请求
  if (req.path.includes('/email')) {
    return handleEmailMock(req, res, next);
  }

  next();
}

/**
 * 处理微信Mock请求
 */
function handleWechatMock(req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('/login')) {
    const { code } = req.body;
    const result = WechatServiceMock.mockLogin(code);
    return res.json({ success: true, data: result });
  }

  next();
}

/**
 * 处理支付Mock请求
 */
function handlePaymentMock(req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('/wechat')) {
    const result = WechatServiceMock.mockPayment(req.body);
    return res.json({ success: true, data: result });
  }

  if (req.path.includes('/alipay')) {
    const result = PaymentServiceMock.mockAlipayPayment(req.body);
    return res.json({ success: true, data: result });
  }

  next();
}

/**
 * 处理短信Mock请求
 */
function handleSmsMock(req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('/send')) {
    const { phone } = req.body;
    const result = SmsServiceMock.sendSmsCode(phone);
    return res.json(result);
  }

  if (req.path.includes('/verify')) {
    const { phone, code } = req.body;
    const result = SmsServiceMock.verifySmsCode(phone, code);
    return res.json(result);
  }

  next();
}

/**
 * 处理邮件Mock请求
 */
function handleEmailMock(req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('/send')) {
    const { email } = req.body;
    const result = EmailServiceMock.sendEmailCode(email);
    return res.json(result);
  }

  if (req.path.includes('/verify')) {
    const { email, code } = req.body;
    const result = EmailServiceMock.verifyEmailCode(email, code);
    return res.json(result);
  }

  next();
}

/**
 * 清理Mock数据
 */
export function cleanupMockData(): void {
  mockData.wechatUsers.clear();
  mockData.paymentOrders.clear();
  mockData.smsCodes.clear();
  mockData.emailCodes.clear();
  console.log('✅ Mock数据已清理');
}

// 导出Mock数据访问器（用于测试验证）
export function getMockData() {
  return { ...mockData };
}

