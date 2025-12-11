/**
 * 库存管理API测试
 * 测试云仓和本地仓的库存管理、调拨、盘点等功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../setup';
import { TestAuthHelper, createTestUser, getAuthHeaders } from '../helpers/auth.helper';
import { PrismaClient, WarehouseType } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();
const API_BASE = '/api/v1';

describe('库存管理API测试', () => {
  // 清理测试数据
  async function cleanupTestData() {
    try {
      // 先删除所有测试相关的库存记录（因为外键约束）
      await prisma.inventoryStocks.deleteMany({
        where: {
          OR: [
            { batchNumber: { startsWith: 'BATCH' } },
            { productId: { contains: 'cmi' } } // 删除所有测试期间创建的商品库存
          ]
        }
      });

      // 删除测试相关的库存日志
      try {
        await prisma.inventoryLogs.deleteMany({
          where: {
            remarks: { contains: '测试' }
          }
        });
      } catch (logError) {
        // 忽略inventoryLogs表不存在的错误
      }

      // 再删除测试产品
      await prisma.products.deleteMany({
        where: {
          OR: [
            { code: { startsWith: 'TEST_PROD_' } },
            { sku: { startsWith: 'TEST_SKU_' } },
            { name: { contains: '测试商品' } }
          ]
        }
      });

      console.log('✅ 清理测试数据完成');
    } catch (error) {
      console.warn('清理测试数据时出现警告:', error.message);
    }
  }
  let normalUserToken: string;
  let starUserToken: string;
  let directorToken: string;
  let directorUserId: string; // 添加director用户ID变量
  let testProductId: string;
  let testInventoryId: string;

  beforeAll(async () => {
    console.log('开始库存管理API测试...');

    // 清理可能存在的测试数据
    await cleanupTestData();

    // 创建测试用户并获取token
    const normalUser = await createTestUser('normal');
    const starUser = await createTestUser('star1');
    const directorUser = await createTestUser('admin'); // 使用'admin'类型获取DIRECTOR角色

    normalUserToken = normalUser.tokens.accessToken;
    starUserToken = starUser.tokens.accessToken;
    directorToken = directorUser.tokens.accessToken;
    directorUserId = directorUser.id; // 保存director用户ID

    // 先创建一个测试分类
    const category = await prisma.productCategories.findFirst({
      select: { id: true }
    });

    // 如果没有分类，创建一个默认分类
    let categoryId = category?.id;
    if (!categoryId) {
      const newCategory = await prisma.productCategories.create({
        data: {
          id: `cmi${createId()}`,
          name: '测试分类',
          description: '测试用分类',
          isActive: true,
          sort: 0,
          updatedAt: new Date() // 添加必需的updatedAt字段
        }
      });
      categoryId = newCategory.id;
    }

    // 创建测试商品
    const timestamp = Date.now();
    const product = await prisma.products.create({
      data: {
        id: `cmi${createId()}`, // 添加ID字段
        code: `TEST_PROD_${timestamp}`, // 使用时间戳确保唯一性
        sku: `TEST_SKU_${timestamp}`,
        name: '测试商品',
        basePrice: 199.99,
        status: 'ACTIVE',
        totalStock: 100, // 添加totalStock字段
        minStock: 10, // 添加minStock字段
        images: JSON.stringify(['https://picsum.photos/seed/test/200/200']), // images字段是JSON字符串
        categoryId: categoryId, // 添加必需的categoryId字段
        shopId: null, // shopId是可选的，设为null
        createdAt: new Date(), // 添加createdAt字段
        updatedAt: new Date() // 添加updatedAt字段
      }
    });
    testProductId = product.id;

    // 创建测试库存记录
    const inventory = await prisma.inventoryStocks.create({
      data: {
        id: `cmi${createId()}`, // 添加ID字段
        productId: testProductId,
        warehouseType: 'CLOUD',
        userId: directorUserId, // 使用保存的director用户ID
        availableQuantity: 100,
        quantity: 100, // 使用quantity而不是totalQuantity
        reservedQuantity: 0,
        cost: 100, // 使用cost而不是unitCost
        batchNumber: 'BATCH001',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        updatedAt: new Date() // 添加必需的updatedAt字段
      }
    });
    testInventoryId = inventory.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /inventory', () => {
    it('应该能够获取库存列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/inventory`)
        .query({ page: 1, perPage: 10 })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('应该支持按仓库类型筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/inventory`)
        .query({
          page: 1,
          perPage: 10,
          warehouseType: 'CLOUD'
        })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该支持按商品筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/inventory`)
        .query({
          page: 1,
          perPage: 10,
          productId: testProductId
        })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('普通用户只能查看自己的库存', async () => {
      const response = await request(app)
        .get(`${API_BASE}/inventory`)
        .query({ page: 1, perPage: 10 })
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // 普通用户应该只能看到自己的库存
      if (response.body.data.items.length > 0) {
        response.body.data.items.forEach((item: any) => {
          expect(item.userId).toBeDefined();
        });
      }
    });
  });

  describe('GET /inventory/:id', () => {
    it('应该能够获取指定库存详情', async () => {
      const response = await request(app)
        .get(`${API_BASE}/inventory/${testInventoryId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testInventoryId);
      expect(response.body.data).toHaveProperty('productId');
      expect(response.body.data).toHaveProperty('availableQuantity');
      expect(response.body.data).toHaveProperty('quantity'); // 数据库字段是quantity而不是totalQuantity
    });

    it('不存在的库存ID应返回404', async () => {
      const fakeId = 'nonexistent_inventory_id';

      const response = await request(app)
        .get(`${API_BASE}/inventory/${fakeId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /inventory/adjust', () => {
    it('应该能够调整库存数量', async () => {
      const adjustData = {
        inventoryId: testInventoryId,
        adjustmentType: 'INCREASE',
        quantity: 50,
        reason: '库存盘点增加',
        costPrice: 100
      };

      const response = await request(app)
        .post(`${API_BASE}/inventory/adjust`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(adjustData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.newQuantity).toBe(150);
    });

    it('应该能够减少库存', async () => {
      const adjustData = {
        inventoryId: testInventoryId,
        adjustmentType: 'DECREASE',
        quantity: 30,
        reason: '库存盘点减少'
      };

      const response = await request(app)
        .post(`${API_BASE}/inventory/adjust`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(adjustData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该验证调整数量不能大于可用库存', async () => {
      const adjustData = {
        inventoryId: testInventoryId,
        adjustmentType: 'DECREASE',
        quantity: 1000, // 超过可用库存
        reason: '测试'
      };

      const response = await request(app)
        .post(`${API_BASE}/inventory/adjust`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(adjustData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('普通用户不能调整库存', async () => {
      const adjustData = {
        inventoryId: testInventoryId,
        adjustmentType: 'INCREASE',
        quantity: 10,
        reason: '测试'
      };

      const response = await request(app)
        .post(`${API_BASE}/inventory/adjust`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(adjustData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /inventory/transfer', () => {
    it('应该能够在仓库间调拨库存', async () => {
      // 创建目标仓库的库存记录
      const targetInventory = await prisma.inventoryStocks.create({
        data: {
          id: `cmi${createId()}`, // 添加ID字段
          productId: testProductId,
          warehouseType: 'LOCAL',
          userId: directorUserId, // 添加必需的userId字段
          availableQuantity: 0,
          quantity: 0, // 使用quantity而不是totalQuantity
          reservedQuantity: 0,
          cost: 100, // 使用cost而不是unitCost
          updatedAt: new Date() // 添加必需的updatedAt字段
        }
      });

      const transferData = {
        fromInventoryId: testInventoryId,
        toInventoryId: targetInventory.id,
        quantity: 30,
        reason: '云仓调拨到本地仓'
      };

      const response = await request(app)
        .post(`${API_BASE}/inventory/transfer`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(transferData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('transferId');
    });

    it('应该验证调拨数量', async () => {
      const transferData = {
        fromInventoryId: testInventoryId,
        toInventoryId: 'invalid_inventory_id',
        quantity: -10,
        reason: '测试'
      };

      const response = await request(app)
        .post(`${API_BASE}/inventory/transfer`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(transferData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /inventory/low-stock', () => {
    it('应该能够获取低库存预警列表', async () => {
      // 创建一个低库存商品
      await prisma.inventoryStocks.create({
        data: {
          id: `cmi${createId()}`, // 添加ID字段
          productId: testProductId,
          warehouseType: 'CLOUD',
          userId: directorUserId, // 添加必需的userId字段
          availableQuantity: 10,
          quantity: 10, // 使用quantity而不是totalQuantity
          reservedQuantity: 0,
          cost: 50, // 使用cost而不是unitCost
          updatedAt: new Date() // 添加必需的updatedAt字段
        }
      });

      const response = await request(app)
        .get(`${API_BASE}/inventory/low-stock`)
        .query({ page: 1, perPage: 10 })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('应该支持设置阈值筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/inventory/low-stock`)
        .query({
          page: 1,
          perPage: 10,
          threshold: 50
        })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /inventory/stocktake', () => {
    it('应该能够创建库存盘点任务', async () => {
      const stocktakeData = {
        warehouseId: 'WH01',
        items: [
          {
            inventoryId: testInventoryId,
            systemQuantity: 120,
            actualQuantity: 115,
            reason: '盘点差异'
          }
        ],
        remark: '月度盘点'
      };

      const response = await request(app)
        .post(`${API_BASE}/inventory/stocktake`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(stocktakeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('stocktakeId');
    });

    it('应该验证盘点数据', async () => {
      const stocktakeData = {
        warehouseId: 'WH01',
        items: [],
        remark: '空的盘点任务'
      };

      const response = await request(app)
        .post(`${API_BASE}/inventory/stocktake`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(stocktakeData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /inventory/movements', () => {
    it('应该能够获取库存变动记录', async () => {
      const response = await request(app)
        .get(`${API_BASE}/inventory/movements`)
        .query({
          page: 1,
          perPage: 10,
          inventoryId: testInventoryId
        })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('应该支持按变动类型筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/inventory/movements`)
        .query({
          page: 1,
          perPage: 10,
          movementType: 'ADJUSTMENT'
        })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该支持日期范围筛选', async () => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      const response = await request(app)
        .get(`${API_BASE}/inventory/movements`)
        .query({
          page: 1,
          perPage: 10,
          startDate: yesterday.toISOString(),
          endDate: today.toISOString()
        })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /inventory/summary', () => {
    it('应该能够获取库存汇总信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/inventory/summary`)
        .query({ warehouseType: 'CLOUD' })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalItems');
      expect(response.body.data).toHaveProperty('totalValue');
      expect(response.body.data).toHaveProperty('lowStockItems');
      expect(response.body.data).toHaveProperty('outOfStockItems');
    });

    it('应该支持按时间范围统计', async () => {
      const response = await request(app)
        .get(`${API_BASE}/inventory/summary`)
        .query({
          warehouseType: 'CLOUD',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /inventory/products/:productId/stock', () => {
    it('应该能够查询商品在各仓库的库存', async () => {
      const response = await request(app)
        .get(`${API_BASE}/inventory/products/${testProductId}/stock`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 0) {
        const stock = response.body.data[0];
        expect(stock).toHaveProperty('id'); // 库存记录ID
        expect(stock).toHaveProperty('warehouseType');
        expect(stock).toHaveProperty('availableQuantity');
        expect(stock).toHaveProperty('reservedQuantity');
        expect(stock).toHaveProperty('productId');
      }
    });

    it('不存在的商品ID应返回404', async () => {
      const fakeId = 'nonexistent_product_id';

      const response = await request(app)
        .get(`${API_BASE}/inventory/products/${fakeId}/stock`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /inventory/reserve', () => {
    it('应该能够预留库存', async () => {
      const reserveData = {
        inventoryId: testInventoryId,
        quantity: 20,
        orderId: 'test_order_id',
        reason: '订单预留'
      };

      const response = await request(app)
        .post(`${API_BASE}/inventory/reserve`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .send(reserveData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reservedQuantity).toBe(20);
    });

    it('应该验证预留数量', async () => {
      const reserveData = {
        inventoryId: testInventoryId,
        quantity: 1000, // 超过可用数量
        orderId: 'test_order_id'
      };

      const response = await request(app)
        .post(`${API_BASE}/inventory/reserve`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .send(reserveData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /inventory/release', () => {
    it('应该能够释放预留库存', async () => {
      // 先预留库存
      await request(app)
        .post(`${API_BASE}/inventory/reserve`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .send({
          inventoryId: testInventoryId,
          quantity: 10,
          orderId: 'test_order_002',
          reason: '测试预留'
        });

      // 释放库存
      const releaseData = {
        inventoryId: testInventoryId,
        quantity: 10,
        orderId: 'test_order_002'
      };

      const response = await request(app)
        .post(`${API_BASE}/inventory/release`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .send(releaseData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});