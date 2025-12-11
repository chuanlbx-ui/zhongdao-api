/**
 * 核心模块TypeScript类型安全测试
 *
 * 这个测试文件验证核心模块的基本类型安全性
 * 确保修复后的模块能够正常编译和运行
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// 导入修复后的模块
import { PaymentService } from '../../src/modules/payment/payment.service';
import { PurchaseService } from '../../src/modules/purchase/purchase.service';
import { PaymentCallbackHandler } from '../../src/shared/payments/callbacks/handler';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentChannel,
  PaymentCreateRequest,
  RefundCreateRequest
} from '../../src/modules/payment/types';

describe('核心模块类型安全测试', () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
        }
      }
    });
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('PaymentService 类型检查', () => {
    it('应该能够创建PaymentService实例', () => {
      expect(() => {
        const paymentService = new PaymentService();
        expect(paymentService).toBeInstanceOf(PaymentService);
      }).not.toThrow();
    });

    it('应该接受正确的PaymentCreateRequest类型', () => {
      const validRequest: PaymentCreateRequest = {
        userId: 'test-user-id',
        amount: 100,
        channel: PaymentChannel.WECHAT,
        method: PaymentMethod.WECHAT,
        subject: '测试支付',
        description: '测试支付描述'
      };

      expect(validRequest.channel).toBe(PaymentChannel.WECHAT);
      expect(validRequest.method).toBe(PaymentMethod.WECHAT);
      expect(validRequest.amount).toBe(100);
    });

    it('应该接受正确的RefundCreateRequest类型', () => {
      const validRequest: RefundCreateRequest = {
        paymentId: 'test-payment-id',
        refundAmount: 50,
        refundReason: '测试退款',
        applyUserId: 'test-user-id'
      };

      expect(validRequest.paymentId).toBe('test-payment-id');
      expect(validRequest.refundAmount).toBe(50);
      expect(validRequest.applyUserId).toBe('test-user-id');
    });

    it('应该导出所有必要的枚举类型', () => {
      expect(PaymentMethod).toBeDefined();
      expect(PaymentStatus).toBeDefined();
      expect(PaymentChannel).toBeDefined();

      // 验证枚举值
      expect(PaymentMethod.WECHAT).toBe('WECHAT');
      expect(PaymentMethod.ALIPAY).toBe('ALIPAY');
      expect(PaymentMethod.POINTS).toBe('POINTS');

      expect(PaymentStatus.UNPAID).toBe('UNPAID');
      expect(PaymentStatus.PAID).toBe('PAID');
      expect(PaymentStatus.FAILED).toBe('FAILED');

      expect(PaymentChannel.WECHAT).toBe('WECHAT');
      expect(PaymentChannel.ALIPAY).toBe('ALIPAY');
      expect(PaymentChannel.POINTS).toBe('POINTS');
    });
  });

  describe('PurchaseService 类型检查', () => {
    it('应该能够创建PurchaseService实例', () => {
      expect(() => {
        const purchaseService = new PurchaseService();
        expect(purchaseService).toBeInstanceOf(PurchaseService);
      }).not.toThrow();
    });

    it('应该具有必要的属性和方法', () => {
      const purchaseService = new PurchaseService();

      // 验证方法存在
      expect(typeof purchaseService.validatePurchaseRules).toBe('function');
      expect(typeof purchaseService.createPurchaseOrder).toBe('function');
      expect(typeof purchaseService.processPurchase).toBe('function');
      expect(typeof purchaseService.getPurchaseHistory).toBe('function');
    });
  });

  describe('PaymentCallbackHandler 类型检查', () => {
    it('应该能够调用PaymentCallbackHandler的静态方法', () => {
      expect(typeof PaymentCallbackHandler.handlePaymentSuccess).toBe('function');
      expect(typeof PaymentCallbackHandler.handlePaymentFailure).toBe('function');
      expect(typeof PaymentCallbackHandler.handleRefundSuccess).toBe('function');
    });
  });

  describe('模块导入完整性检查', () => {
    it('应该能够导入所有修复后的模块', async () => {
      // 动态导入测试
      const paymentModule = await import('../../src/modules/payment/payment.service');
      const purchaseModule = await import('../../src/modules/purchase/purchase.service');
      const callbackModule = await import('../../src/shared/payments/callbacks/handler');
      const typesModule = await import('../../src/modules/payment/types');

      expect(paymentModule.PaymentService).toBeDefined();
      expect(purchaseModule.PurchaseService).toBeDefined();
      expect(callbackModule.PaymentCallbackHandler).toBeDefined();
      expect(typesModule.PaymentMethod).toBeDefined();
    });
  });

  describe('类型兼容性测试', () => {
    it('PaymentCreateRequest字段类型应该正确', () => {
      const request: PaymentCreateRequest = {
        userId: 'user-123',
        amount: 99.99,
        channel: PaymentChannel.ALIPAY,
        method: PaymentMethod.ALIPAY,
        subject: '订单支付',
        clientIp: '127.0.0.1',
        extra: { orderId: 'order-123' }
      };

      // 类型断言测试
      expect(typeof request.userId).toBe('string');
      expect(typeof request.amount).toBe('number');
      expect(request.channel).toBe(PaymentChannel.ALIPAY);
      expect(request.method).toBe(PaymentMethod.ALIPAY);
      expect(request.extra).toBeDefined();
      expect(request.extra?.orderId).toBe('order-123');
    });
  });
});