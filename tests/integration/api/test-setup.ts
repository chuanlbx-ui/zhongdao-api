import { Express } from 'express';
import request from 'supertest';
import { app } from '../../../src/app';

/**
 * API测试工具类
 */
export class ApiTestUtils {
  private static app: Express;
  private static authToken: string = '';

  /**
   * 初始化测试应用
   */
  static async initialize(): Promise<Express> {
    if (!this.app) {
      this.app = app;
      // 获取测试Token
      await this.getTestToken();
    }
    return this.app;
  }

  /**
   * 获取测试Token
   */
  private static async getTestToken(): Promise<void> {
    try {
      // 使用固定的测试Token（在开发环境中）
      this.authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbl91c2VyIiwicm9sZSI6IkFETUlOIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsImFkbWluIiwidXNlcjpjcmVhdGUiLCJ1c2VyOnJlYWQiLCJ1c2VyOnVwZGF0ZSIsInVzZXI6ZGVsZXRlIl0sImlhdCI6MTczMjA5NjgwMCwiZXhwIjo5OTk5OTk5OTk5LCJqdGkiOiJ0ZXN0X3Rva2VuXzE3MzIwOTY4MDAifQ.VALID_SIGNATURE_HERE';
      console.log('🔑 使用测试Token进行API认证');
    } catch (error) {
      console.error('❌ 获取测试Token失败:', error);
      throw error;
    }
  }

  /**
   * 获取认证头
   */
  static getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * 发送GET请求
   */
  static async get(endpoint: string, headers?: Record<string, string>) {
    const app = await this.initialize();
    return request(app)
      .get(endpoint)
      .set(headers || this.getAuthHeaders());
  }

  /**
   * 发送POST请求
   */
  static async post(endpoint: string, data?: any, headers?: Record<string, string>) {
    const app = await this.initialize();
    return request(app)
      .post(endpoint)
      .send(data)
      .set(headers || this.getAuthHeaders());
  }

  /**
   * 发送PUT请求
   */
  static async put(endpoint: string, data?: any, headers?: Record<string, string>) {
    const app = await this.initialize();
    return request(app)
      .put(endpoint)
      .send(data)
      .set(headers || this.getAuthHeaders());
  }

  /**
   * 发送DELETE请求
   */
  static async delete(endpoint: string, headers?: Record<string, string>) {
    const app = await this.initialize();
    return request(app)
      .delete(endpoint)
      .set(headers || this.getAuthHeaders());
  }

  /**
   * 发送PATCH请求
   */
  static async patch(endpoint: string, data?: any, headers?: Record<string, string>) {
    const app = await this.initialize();
    return request(app)
      .patch(endpoint)
      .send(data)
      .set(headers || this.getAuthHeaders());
  }

  /**
   * 生成测试用户数据
   */
  static generateTestUser(overrides?: any) {
    return {
      openid: `test_openid_${Date.now()}`,
      nickname: '测试用户',
      avatarUrl: 'https://example.com/avatar.jpg',
      phone: `138${Date.now().toString().slice(-8)}`,
      level: 'NORMAL',
      isActive: true,
      ...overrides
    };
  }

  /**
   * 生成测试商品数据
   */
  static generateTestProduct(overrides?: any) {
    return {
      name: '测试商品',
      description: '这是一个测试商品',
      basePrice: 599.00,
      categoryId: 'test_category_id',
      status: 'ACTIVE',
      images: ['https://example.com/product.jpg'],
      tags: ['test', '新品'],
      ...overrides
    };
  }

  /**
   * 生成测试订单数据
   */
  static generateTestOrder(overrides?: any) {
    return {
      userId: 'test_user_id',
      items: [
        {
          productId: 'test_product_id',
          specId: 'test_spec_id',
          quantity: 1,
          price: 599.00
        }
      ],
      totalAmount: 599.00,
      status: 'PENDING',
      paymentMethod: 'WECHAT',
      shippingAddress: {
        name: '测试收件人',
        phone: '13800138000',
        address: '测试地址'
      },
      ...overrides
    };
  }

  /**
   * 生成测试支付数据
   */
  static generateTestPayment(overrides?: any) {
    return {
      orderId: `test_order_${Date.now()}`,
      amount: 0.01,
      subject: '测试支付',
      method: 'WECHAT_JSAPI',
      openid: 'test_openid',
      clientIp: '127.0.0.1',
      ...overrides
    };
  }

  /**
   * 等待指定时间
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 验证API响应格式
   */
  static validateApiResponse(response: any, expectedStatus: number = 200): void {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success');
    if (response.body.success) {
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
    } else {
      expect(response.body).toHaveProperty('error');
    }
  }

  /**
   * 验证分页响应格式
   */
  static validatePaginatedResponse(response: any): void {
    this.validateApiResponse(response);
    const { data } = response.body;
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('pagination');
    expect(data.pagination).toHaveProperty('page');
    expect(data.pagination).toHaveProperty('perPage');
    expect(data.pagination).toHaveProperty('total');
    expect(data.pagination).toHaveProperty('totalPages');
  }
}