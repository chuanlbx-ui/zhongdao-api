#!/usr/bin/env tsx

/**
 * 简化版测试数据生成器
 */

import fs from 'fs';
import path from 'path';

/**
 * 生成基础测试数据
 */
function generateBasicMockData() {
  console.log('🔄 开始生成基础测试数据...');

  // 生成用户数据
  const users = [
    {
      id: 'user_001',
      phone: '13800138000',
      nickname: '测试用户1',
      level: 'VIP',
      status: 'active',
      inviteCode: 'TEST123',
      totalOrders: 10,
      totalAmount: 5000
    },
    {
      id: 'user_002',
      phone: '13900139000',
      nickname: '测试用户2',
      level: 'STAR_1',
      status: 'active',
      inviteCode: 'TEST456',
      totalOrders: 50,
      totalAmount: 25000
    }
  ];

  // 生成商品数据
  const products = [
    {
      id: 'prod_001',
      name: '测试商品1',
      description: '这是一个测试商品',
      images: ['https://example.com/product1.jpg'],
      categoryId: 'cat_001',
      price: 299.00,
      originalPrice: 399.00,
      stock: 100,
      sales: 50,
      status: 'active'
    },
    {
      id: 'prod_002',
      name: '测试商品2',
      description: '这是另一个测试商品',
      images: ['https://example.com/product2.jpg'],
      categoryId: 'cat_001',
      price: 199.00,
      originalPrice: 299.00,
      stock: 200,
      sales: 100,
      status: 'active'
    }
  ];

  // 生成分类数据
  const categories = [
    {
      id: 'cat_001',
      name: '保健品',
      level: 1,
      parentId: null,
      status: 'active'
    },
    {
      id: 'cat_002',
      name: '护肤品',
      level: 1,
      parentId: null,
      status: 'active'
    }
  ];

  // 生成订单数据
  const orders = [
    {
      id: 'order_001',
      userId: 'user_001',
      orderNo: 'ZD20241201001',
      items: [
        {
          productId: 'prod_001',
          quantity: 1,
          price: 299.00
        }
      ],
      totalAmount: 299.00,
      status: 'pending',
      paymentMethod: 'wechat'
    }
  ];

  // 生成积分流水数据
  const pointsTransactions = [
    {
      id: 'txn_001',
      userId: 'user_001',
      type: 'RECHARGE',
      amount: 100.00,
      balance: 1100.00,
      status: 'success'
    }
  ];

  // 确保输出目录存在
  const outputDir = path.join(__dirname, '../mock-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 保存数据
  const data = {
    users,
    products,
    categories,
    orders,
    pointsTransactions,
    generated: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(outputDir, 'basic-mock-data.json'),
    JSON.stringify(data, null, 2),
    'utf-8'
  );

  console.log('✅ 基础测试数据生成完成:', path.join(outputDir, 'basic-mock-data.json'));

  // 生成前端测试数据
  const frontendData = {
    auth: {
      loginResponse: {
        success: true,
        data: {
          user: users[0],
          token: 'mock-jwt-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 7200
        }
      }
    },
    products: {
      productList: {
        success: true,
        data: {
          products,
          pagination: {
            page: 1,
            perPage: 10,
            total: products.length,
            totalPages: 1
          }
        }
      }
    },
    orders: {
      orderList: {
        success: true,
        data: {
          orders,
          pagination: {
            page: 1,
            perPage: 10,
            total: orders.length,
            totalPages: 1
          }
        }
      }
    }
  };

  fs.writeFileSync(
    path.join(outputDir, 'frontend-test-data.json'),
    JSON.stringify(frontendData, null, 2),
    'utf-8'
  );

  console.log('✅ 前端测试数据生成完成:', path.join(outputDir, 'frontend-test-data.json'));
}

// 执行生成
generateBasicMockData();