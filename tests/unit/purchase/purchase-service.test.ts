import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PurchaseService, purchaseService } from '@/modules/purchase/purchase.service';
import { PurchaseValidator } from '@/modules/purchase/purchase-validator';
import { SupplyChainPathFinder } from '@/modules/purchase/supply-chain-path-finder';
import { CommissionCalculator } from '@/modules/purchase/commission-calculator';
import { PurchaseStatus } from '@/modules/purchase/types';
import { prisma } from '@/shared/database/client';
import { userLevelService } from '@/modules/user/level.service';

// Mock dependencies
vi.mock('@/shared/database/client');
vi.mock('@/shared/utils/logger');
vi.mock('@/modules/user/level.service');

const mockPrisma = prisma as any;
const mockUserLevelService = userLevelService as any;

describe('PurchaseService', () => {
  let service: PurchaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PurchaseService();
  });

  describe('createPurchaseOrder', () => {
    it('should create purchase order successfully', async () => {
      // Arrange
      const params = {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        productId: 'product-1',
        skuId: 'sku-1',
        quantity: 5
      };

      const mockValidationResult = {
        isValid: true,
        canPurchase: true,
        reasons: []
      };

      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        sku: {
          id: 'sku-1',
          price: 100,
          bottlesPerCase: 24,
          stock: 100
        }
      };

      const mockOrder = {
        id: 'order-1',
        orderNo: 'PO1234567890ABC',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        productId: 'product-1',
        skuId: 'sku-1',
        quantity: 5,
        unitPrice: 100,
        totalAmount: 500,
        totalBottles: 120,
        status: PurchaseStatus.PENDING,
        paymentStatus: 'UNPAID',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.spyOn(service, 'validatePurchasePermission').mockResolvedValue(mockValidationResult);
      mockPrisma.products.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.purchaseOrder.create.mockResolvedValue(mockOrder);
      mockPrisma.productSkus.update.mockResolvedValue({});

      // Act
      const result = await service.createPurchaseOrder(params);

      // Assert
      expect(result.success).toBe(true);
      expect(result.order).toBeTruthy();
      expect(result.order?.orderNo).toBe('PO1234567890ABC');
      expect(result.order?.totalAmount).toBe(500);
      expect(result.message).toBe('采购订单创建成功');
    });

    it('should reject when validation fails', async () => {
      // Arrange
      const params = {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        productId: 'product-1',
        skuId: 'sku-1',
        quantity: 5
      };

      const mockValidationResult = {
        isValid: false,
        canPurchase: false,
        reasons: ['库存不足']
      };

      vi.spyOn(service, 'validatePurchasePermission').mockResolvedValue(mockValidationResult);

      // Act
      const result = await service.createPurchaseOrder(params);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('库存不足');
      expect(result.message).toBe('采购验证失败');
    });

    it('should reject when product not found', async () => {
      // Arrange
      const params = {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        productId: 'invalid-product',
        skuId: 'sku-1',
        quantity: 5
      };

      const mockValidationResult = {
        isValid: true,
        canPurchase: true,
        reasons: []
      };

      vi.spyOn(service, 'validatePurchasePermission').mockResolvedValue(mockValidationResult);
      mockPrisma.products.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.createPurchaseOrder(params);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('产品信息不完整');
      expect(result.message).toBe('创建采购订单失败');
    });
  });

  describe('confirmPurchaseOrder', () => {
    it('should confirm purchase order successfully', async () => {
      // Arrange
      const orderId = 'order-1';
      const operatorId = 'operator-1';

      const mockOrder = {
        id: orderId,
        orderNo: 'PO123',
        status: PurchaseStatus.PENDING,
        skuId: 'sku-1',
        quantity: 5,
        product: {
          sku: {
            stock: 10
          }
        },
        metadata: {}
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: PurchaseStatus.CONFIRMED,
        confirmedAt: new Date()
      };

      mockPrisma.purchaseOrderss.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue(mockUpdatedOrder);
      mockPrisma.productSkus.update.mockResolvedValue({});

      // Act
      const result = await service.confirmPurchaseOrder(orderId, operatorId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.order?.status).toBe(PurchaseStatus.CONFIRMED);
      expect(result.message).toBe('订单确认成功');
    });

    it('should reject when order not found', async () => {
      // Arrange
      mockPrisma.purchaseOrderss.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.confirmPurchaseOrder('invalid-order', 'operator-1');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('订单不存在');
    });

    it('should reject when order status is not pending', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-1',
        status: PurchaseStatus.COMPLETED
      };

      mockPrisma.purchaseOrderss.findUnique.mockResolvedValue(mockOrder);

      // Act
      const result = await service.confirmPurchaseOrder('order-1', 'operator-1');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('订单状态不允许确认');
    });

    it('should reject when insufficient stock', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-1',
        status: PurchaseStatus.PENDING,
        skuId: 'sku-1',
        quantity: 10,
        product: {
          sku: {
            stock: 5 // Less than required
          }
        }
      };

      mockPrisma.purchaseOrderss.findUnique.mockResolvedValue(mockOrder);

      // Act
      const result = await service.confirmPurchaseOrder('order-1', 'operator-1');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('库存不足');
    });
  });

  describe('completePurchaseOrder', () => {
    it('should complete purchase order with commission', async () => {
      // Arrange
      const orderId = 'order-1';
      const operatorId = 'operator-1';

      const mockOrder = {
        id: orderId,
        orderNo: 'PO123',
        status: PurchaseStatus.CONFIRMED,
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        totalAmount: 1000,
        totalBottles: 120,
        seller: {
          id: 'seller-1',
          level: 'STAR_1',
          referrerId: 'upline-1'
        },
        buyer: {
          id: 'buyer-1',
          level: 'NORMAL',
          referrerId: null
        },
        metadata: {}
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: PurchaseStatus.COMPLETED,
        paymentStatus: 'PAID',
        completedAt: new Date()
      };

      const mockCommissionRecords = [
        {
          id: 'commission-1',
          userId: 'seller-1',
          amount: 50
        }
      ];

      mockPrisma.purchaseOrderss.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue(mockUpdatedOrder);
      mockPrisma.commissionRecord.create.mockResolvedValue(mockCommissionRecords[0]);
      mockPrisma.userStats.upsert.mockResolvedValue({});
      mockUserLevelService.checkUpgradeConditions.mockResolvedValue({
        canUpgrade: false
      });

      // Act
      const result = await service.completePurchaseOrder(orderId, operatorId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.order?.status).toBe(PurchaseStatus.COMPLETED);
      expect(result.commissionRecords).toHaveLength(1);
      expect(result.message).toBe('订单完成成功');
    });

    it('should trigger upgrade when conditions met', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-1',
        status: PurchaseStatus.CONFIRMED,
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        totalAmount: 1000,
        totalBottles: 120,
        seller: { level: 'STAR_1' },
        buyer: { level: 'NORMAL' }
      };

      mockPrisma.purchaseOrderss.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({ ...mockOrder, status: PurchaseStatus.COMPLETED });
      mockPrisma.commissionRecord.create.mockResolvedValue({});
      mockPrisma.userStats.upsert.mockResolvedValue({});
      mockPrisma.levelUpgradeRecord.create.mockResolvedValue({});

      mockUserLevelService.checkUpgradeConditions.mockResolvedValue({
        canUpgrade: true,
        currentLevel: 'NORMAL',
        nextLevel: 'VIP'
      });

      // Act
      await service.completePurchaseOrder('order-1', 'operator-1');

      // Assert
      expect(mockPrisma.levelUpgradeRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'buyer-1',
          previousLevel: 'NORMAL',
          newLevel: 'VIP',
          upgradeType: 'AUTO'
        })
      });
    });
  });

  describe('getUserPurchaseOrders', () => {
    it('should get user purchase orders as buyer', async () => {
      // Arrange
      const userId = 'user-1';
      const mockOrders = [
        {
          id: 'order-1',
          buyerId: userId,
          sellerId: 'seller-1',
          product: { name: 'Product 1' },
          buyer: { nickname: 'Buyer' },
          seller: { nickname: 'Seller' },
          createdAt: new Date()
        }
      ];

      mockPrisma.purchaseOrderss.findMany.mockResolvedValue(mockOrders);
      mockPrisma.purchaseOrderss.count.mockResolvedValue(1);

      // Act
      const result = await service.getUserPurchaseOrders(userId, 'buyer');

      // Assert
      expect(result.orders).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.orders[0].buyerId).toBe(userId);
    });

    it('should get user purchase orders as seller', async () => {
      // Arrange
      const userId = 'seller-1';
      const mockOrders = [
        {
          id: 'order-1',
          buyerId: 'buyer-1',
          sellerId: userId,
          product: { name: 'Product 1' }
        }
      ];

      mockPrisma.purchaseOrderss.findMany.mockResolvedValue(mockOrders);
      mockPrisma.purchaseOrderss.count.mockResolvedValue(1);

      // Act
      const result = await service.getUserPurchaseOrders(userId, 'seller');

      // Assert
      expect(result.orders[0].sellerId).toBe(userId);
    });

    it('should filter by status', async () => {
      // Arrange
      const userId = 'user-1';
      const mockOrders = [
        {
          id: 'order-1',
          status: PurchaseStatus.COMPLETED
        }
      ];

      mockPrisma.purchaseOrderss.findMany.mockResolvedValue(mockOrders);
      mockPrisma.purchaseOrderss.count.mockResolvedValue(1);

      // Act
      await service.getUserPurchaseOrders(userId, 'buyer', 1, 20, PurchaseStatus.COMPLETED);

      // Assert
      expect(mockPrisma.purchaseOrderss.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          buyerId: userId,
          status: PurchaseStatus.COMPLETED
        }),
        ...expect.any(Object)
      });
    });
  });

  describe('cancelPurchaseOrder', () => {
    it('should cancel pending order', async () => {
      // Arrange
      const orderId = 'order-1';
      const reason = 'Customer request';
      const operatorId = 'operator-1';

      const mockOrder = {
        id: orderId,
        status: PurchaseStatus.PENDING,
        skuId: 'sku-1',
        quantity: 5
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: PurchaseStatus.CANCELLED
      };

      mockPrisma.purchaseOrderss.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue(mockUpdatedOrder);
      mockPrisma.productSkus.update.mockResolvedValue({});

      // Act
      const result = await service.cancelPurchaseOrder(orderId, reason, operatorId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.order?.status).toBe(PurchaseStatus.CANCELLED);
      expect(result.message).toBe('订单取消成功');
    });

    it('should restore stock for confirmed orders', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-1',
        status: PurchaseStatus.CONFIRMED,
        skuId: 'sku-1',
        quantity: 5
      };

      mockPrisma.purchaseOrderss.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({ ...mockOrder, status: PurchaseStatus.CANCELLED });
      mockPrisma.productSkus.update.mockResolvedValue({});

      // Act
      await service.cancelPurchaseOrder('order-1', 'reason', 'operator-1');

      // Assert
      expect(mockPrisma.productSkus.update).toHaveBeenCalledWith({
        where: { id: 'sku-1' },
        data: {
          stock: { increment: 5 },
          reservedStock: { decrement: 5 }
        }
      });
    });

    it('should reject when order is completed', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-1',
        status: PurchaseStatus.COMPLETED
      };

      mockPrisma.purchaseOrderss.findUnique.mockResolvedValue(mockOrder);

      // Act
      const result = await service.cancelPurchaseOrder('order-1', 'reason', 'operator-1');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('订单状态不允许取消');
    });
  });

  describe('delegation methods', () => {
    it('should delegate to validator for validatePurchasePermission', async () => {
      // Arrange
      const mockResult = {
        isValid: true,
        canPurchase: true,
        reasons: []
      };

      vi.spyOn(service['validator'], 'validatePurchasePermission').mockResolvedValue(mockResult);

      // Act
      const result = await service.validatePurchasePermission('buyer-1', 'seller-1', 'product-1', 5);

      // Assert
      expect(result).toBe(mockResult);
      expect(service['validator'].validatePurchasePermission).toHaveBeenCalledWith(
        'buyer-1', 'seller-1', 'product-1', 5
      );
    });

    it('should delegate to pathFinder for findOptimalPurchasePath', async () => {
      // Arrange
      const mockPath = {
        path: [{ userId: 'seller-1', level: 'VIP', distance: 1 }],
        totalDistance: 1,
        isValid: true
      };

      vi.spyOn(service['pathFinder'], 'findOptimalSupplyPath').mockResolvedValue(mockPath);

      // Act
      const result = await service.findOptimalPurchasePath('user-1');

      // Assert
      expect(result).toBe(mockPath);
      expect(service['pathFinder'].findOptimalSupplyPath).toHaveBeenCalledWith('user-1', undefined);
    });

    it('should delegate to commissionCalculator for previewCommission', async () => {
      // Arrange
      const mockPreview = {
        totalCommission: 50,
        commissionBreakdown: []
      };

      vi.spyOn(service['commissionCalculator'], 'previewCommission').mockResolvedValue(mockPreview);

      // Act
      const result = await service.previewCommission('seller-1', 'VIP', 1000);

      // Assert
      expect(result).toBe(mockPreview);
      expect(service['commissionCalculator'].previewCommission).toHaveBeenCalledWith({
        sellerId: 'seller-1',
        sellerLevel: 'VIP',
        totalAmount: 1000
      });
    });
  });

  describe('utility methods', () => {
    it('should get performance stats', () => {
      // Arrange
      const mockStats = {
        totalValidations: 100,
        averageResponseTime: 50
      };

      vi.spyOn(service['validator'], 'getPerformanceStats').mockReturnValue(mockStats);

      // Act
      const stats = service.getPerformanceStats();

      // Assert
      expect(stats).toBe(mockStats);
    });

    it('should clear cache', () => {
      // Arrange
      vi.spyOn(service['pathFinder'], 'clearCache').mockImplementation(() => {});

      // Act
      service.clearCache();

      // Assert
      expect(service['pathFinder'].clearCache).toHaveBeenCalled();
    });
  });
});

describe('purchaseService singleton', () => {
  it('should export singleton instance', () => {
    expect(purchaseService).toBeInstanceOf(PurchaseService);
  });
});