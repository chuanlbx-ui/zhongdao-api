import type { TestDataConfig } from '../types';

/**
 * Comprehensive级别测试数据配置
 * 适用于全面的功能测试和压力测试
 */
export const COMPREHENSIVE_CONFIG: TestDataConfig = {
  // 用户层级配置（总计约223个用户）
  userLevels: {
    normal: 100,    // 普通用户 - 基础消费群体
    vip: 50,       // VIP用户 - 享受8折优惠
    star1: 30,     // 1星店长 - 初级管理者
    star2: 20,     // 2星店长 - 中级管理者
    star3: 15,     // 3星店长 - 高级管理者
    star4: 10,     // 4星店长 - 资深管理者
    star5: 5,      // 5星店长 - 顶级管理者
    director: 3    // 董事 - 最高决策者
  },

  // 店铺配置（总计150个店铺）
  shops: {
    cloud: 100,    // 云店 - 基于业绩的店铺
    wutong: 50     // 五通店 - 一次性购买，享受特殊权益
  },

  // 商品配置（丰富的商品体系）
  products: {
    categories: 20,  // 商品分类 - 涵盖护肤品、保健品、食品等
    products: 500,   // 商品总数 - 丰富的产品线
    variantsPerProduct: 5  // 每个商品规格数 - 不同容量、包装等
  },

  // 订单配置（模拟真实业务场景）
  orders: {
    pending: 100,   // 待处理订单 - 新下单未支付
    paid: 200,      // 已支付订单 - 已支付待发货
    delivered: 300, // 已交付订单 - 完成的交易
    cancelled: 50   // 已取消订单 - 各种取消原因
  },

  // 库存配置（支持多仓库管理）
  inventory: {
    items: 1000,     // 库存项目数 - 多种商品库存
    lowStockThreshold: 20  // 低库存预警阈值
  }
};

/**
 * Minimal级别测试数据配置
 * 适用于基础功能测试
 */
export const MINIMAL_CONFIG: TestDataConfig = {
  userLevels: {
    normal: 5,
    vip: 3,
    star1: 2,
    star2: 1,
    star3: 1,
    star4: 0,
    star5: 0,
    director: 1
  },
  shops: {
    cloud: 3,
    wutong: 1
  },
  products: {
    categories: 3,
    products: 10,
    variantsPerProduct: 2
  },
  orders: {
    pending: 5,
    paid: 8,
    delivered: 10,
    cancelled: 2
  },
  inventory: {
    items: 20,
    lowStockThreshold: 5
  }
};

/**
 * Standard级别测试数据配置
 * 适用于常规测试
 */
export const STANDARD_CONFIG: TestDataConfig = {
  userLevels: {
    normal: 20,
    vip: 10,
    star1: 8,
    star2: 5,
    star3: 3,
    star4: 2,
    star5: 1,
    director: 1
  },
  shops: {
    cloud: 10,
    wutong: 5
  },
  products: {
    categories: 5,
    products: 50,
    variantsPerProduct: 3
  },
  orders: {
    pending: 15,
    paid: 25,
    delivered: 40,
    cancelled: 10
  },
  inventory: {
    items: 80,
    lowStockThreshold: 10
  }
};

// 预定义的配置映射
export const TEST_CONFIGS = {
  minimal: MINIMAL_CONFIG,
  standard: STANDARD_CONFIG,
  comprehensive: COMPREHENSIVE_CONFIG
} as const;

export type TestConfigType = keyof typeof TEST_CONFIGS;