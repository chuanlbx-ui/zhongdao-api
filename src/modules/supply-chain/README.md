# 中道商城供应链采购路径优化系统

这是一个复杂的技术架构核心，实现了多层级供应链的智能路径查找和优化。系统基于等级限制的采购链路智能查找，支持最优价格路径、库存充足检查、多个可选供应商。

## 🚀 核心功能

### 1. 多层级供应链建模
- **图数据结构**：使用邻接矩阵和节点映射构建高效的网络图
- **实时更新**：支持增量更新和自动重建
- **数据验证**：循环引用检测、数据完整性验证
- **性能监控**：执行时间、内存使用、缓存命中率统计

### 2. 智能路径搜索算法
- **BFS广度优先搜索**：适合寻找最短路径
- **DFS深度优先搜索**：适合深度探索路径
- **Dijkstra算法**：基于权重的最短路径
- **A*启发式搜索**：智能引导的路径搜索

### 3. 多目标优化算法
- **价格优先**：找到最低采购价格
- **库存优先**：确保供应商有足够库存
- **路径最短**：减少中间环节，提高效率
- **可靠性优先**：选择高可靠性供应商
- **平衡优化**：综合考虑多个因素
- **遗传算法**：高级多目标优化

### 4. 高性能缓存系统
- **多层缓存**：路径缓存、价格缓存、库存缓存
- **多种策略**：LRU、LFU、TTL、SIZE_BASED
- **智能管理**：自动清理、内存监控、紧急回收
- **批量操作**：批量设置、批量获取、预热功能

### 5. 业务规则验证
- **等级限制**：只能向更高级别的上级进货
- **团队关系**：必须在同一团队内才能采购
- **库存检查**：确保供应商库存充足
- **价格验证**：基于用户等级的差异化定价

## 📊 业务场景

### 供应链层级结构
```
董事 → 五星店长 → 四星店长 → 三星店长 → 二星店长 → 一星店长 → VIP/普通
```

### 核心业务规则
1. **采购权限**：只能向更高级别且非平级的上级进货
2. **平级处理**：如果上级与自己平级，需要再往上找更高等级
3. **业绩分配**：采购链路中所有中间人都算业绩
4. **库存保障**：供应商库存必须充足
5. **价格优化**：基于用户等级的差异化定价

## 🔧 快速开始

### 基础使用

```typescript
import { supplyChainOptimizer, supplyChainIntegrationService } from './index';

// 1. 智能采购（自动寻找最优路径）
const result = await supplyChainIntegrationService.intelligentPurchase({
  buyerId: 'user_123',
  productId: 'product_456',
  quantity: 10
});

if (result.success) {
  console.log('采购成功:', result.order);
  console.log('最优路径:', result.path);
} else {
  console.log('采购失败:', result.error);
}

// 2. 查找最优路径
const path = await supplyChainOptimizer.findOptimalPath(
  'user_123',
  'product_456',
  10,
  {
    strategy: 'BALANCED', // 价格、库存、长度、可靠性平衡
    weights: {
      price: 0.4,      // 价格权重
      inventory: 0.3,  // 库存权重
      length: 0.2,     // 路径长度权重
      reliability: 0.1 // 可靠性权重
    }
  }
);

// 3. 获取多个采购建议
const suggestions = await supplyChainIntegrationService.getPurchaseSuggestions(
  'user_123',
  'product_456',
  10,
  5 // 最多5个建议
);

console.log('采购建议:', suggestions.suggestions);

// 4. 模拟采购影响
const impact = await supplyChainIntegrationService.simulatePurchaseImpact(
  'user_123',
  'product_456',
  10
);

console.log('采购影响分析:', impact);
```

### 批量处理

```typescript
// 批量智能采购
const requests = [
  { buyerId: 'user_1', productId: 'product_1', quantity: 5 },
  { buyerId: 'user_2', productId: 'product_2', quantity: 8 },
  { buyerId: 'user_3', productId: 'product_3', quantity: 3 }
];

const batchResults = await supplyChainIntegrationService.batchIntelligentPurchase(requests);

console.log(`成功: ${batchResults.filter(r => r.success).length}/${requests.length}`);
```

### 高级配置

```typescript
import { supplyChainOptimizer } from './index';

// 自定义优化策略
const path = await supplyChainOptimizer.findOptimalPath(
  'buyer_id',
  'product_id',
  quantity,
  {
    strategy: 'PRICE_FIRST', // 价格优先
    maxPaths: 20,
    useCache: true
  }
);

// 获取系统性能指标
const metrics = supplyChainOptimizer.getPerformanceMetrics();
console.log('系统性能:', metrics);

// 系统健康检查
const health = await supplyChainOptimizer.healthCheck();
console.log('系统健康:', health);
```

## 🎯 优化策略详解

### 1. PRICE_FIRST（价格优先）
```typescript
const result = await supplyChainOptimizer.findOptimalPath(
  buyerId, productId, quantity,
  { strategy: 'PRICE_FIRST' }
);
```
- **适用场景**：成本敏感型采购
- **权重分布**：价格 60%，其他 40%

### 2. INVENTORY_FIRST（库存优先）
```typescript
const result = await supplyChainOptimizer.findOptimalPath(
  buyerId, productId, quantity,
  { strategy: 'INVENTORY_FIRST' }
);
```
- **适用场景**：大批量采购，库存保障优先
- **权重分布**：库存 60%，其他 40%

### 3. RELIABILITY_FIRST（可靠性优先）
```typescript
const result = await supplyChainOptimizer.findOptimalPath(
  buyerId, productId, quantity,
  { strategy: 'RELIABILITY_FIRST' }
);
```
- **适用场景**：重要商品，供应商稳定性要求高
- **权重分布**：可靠性 55%，其他 45%

### 4. CUSTOM（自定义权重）
```typescript
const result = await supplyChainOptimizer.findOptimalPath(
  buyerId, productId, quantity,
  {
    strategy: 'CUSTOM',
    weights: {
      price: 0.5,      // 50% 价格权重
      inventory: 0.2,  // 20% 库存权重
      length: 0.15,    // 15% 路径长度权重
      reliability: 0.15 // 15% 可靠性权重
    }
  }
);
```

## 📈 性能特性

### 时间复杂度
- **路径搜索**：O(b^d)，其中b是分支因子，d是搜索深度
- **多目标优化**：O(n log n)，其中n是路径数量
- **缓存查询**：O(1)，平均时间复杂度

### 空间复杂度
- **邻接矩阵**：O(n²)，其中n是供应链节点数
- **缓存存储**：可配置，默认100MB限制
- **路径存储**：O(m)，其中m是路径数量

### 性能目标
- **实时查询**：单次路径查询 < 100ms
- **批量计算**：100个路径查询 < 5s
- **内存使用**：< 100MB（可配置）
- **缓存命中率**：> 80%

## 🔍 监控和调试

### 性能监控

```typescript
// 获取详细性能指标
const metrics = supplyChainOptimizer.getPerformanceMetrics();
console.log('网络构建器性能:', metrics.networkBuilder);
console.log('路径查找器性能:', metrics.pathFinder);
console.log('路径优化器性能:', metrics.pathOptimizer);

// 缓存统计
const cacheStats = supplyChainOptimizer.getPerformanceMetrics().cache;
console.log('缓存统计:', cacheStats);
```

### 事件监听

```typescript
import { SupplyChainEventType } from './types';

// 监听路径发现事件
supplyChainOptimizer.addEventListener(
  SupplyChainEventType.PATH_FOUND,
  (event) => {
    console.log('发现新路径:', event.data);
  }
);

// 监听性能警告
supplyChainOptimizer.addEventListener(
  SupplyChainEventType.PERFORMANCE_WARNING,
  (event) => {
    console.warn('性能警告:', event.data);
  }
);
```

### 健康检查

```typescript
const health = await supplyChainOptimizer.healthCheck();
if (!health.healthy) {
  console.log('系统问题:');
  Object.entries(health.components).forEach(([name, component]) => {
    if (!component.healthy) {
      console.log(`${name}: ${component.issues.join(', ')}`);
    }
  });
}
```

## 🛠️ 高级功能

### 1. 缓存预热

```typescript
// 预热热门商品和活跃买家
await supplyChainOptimizer.warmupCache(
  ['popular_product_1', 'popular_product_2'], // 热门商品
  ['active_buyer_1', 'active_buyer_2']        // 活跃买家
);
```

### 2. 网络增量更新

```typescript
// 当用户信息变更时，增量更新网络
await supplyChainOptimizer.updateNetwork([
  'updated_user_1',
  'updated_user_2'
]);
```

### 3. 自定义业务规则

```typescript
// 在创建采购订单时，应用自定义业务逻辑
const result = await supplyChainIntegrationService.intelligentPurchase({
  buyerId: 'buyer_123',
  productId: 'product_456',
  quantity: 10,
  preferredSellerId: 'preferred_seller_789', // 偏好供应商
  customWeights: { // 自定义权重
    price: 0.3,
    inventory: 0.4,
    length: 0.2,
    reliability: 0.1
  }
});
```

## 🚨 错误处理

### 常见错误类型

```typescript
import { SupplyChainErrorType } from './types';

try {
  const path = await supplyChainOptimizer.findOptimalPath(buyerId, productId, quantity);
} catch (error) {
  if (error instanceof SupplyChainError) {
    switch (error.type) {
      case SupplyChainErrorType.PATH_NOT_FOUND:
        console.log('未找到采购路径');
        break;
      case SupplyChainErrorType.INSUFFICIENT_STOCK:
        console.log('库存不足');
        break;
      case SupplyChainErrorType.PERMISSION_DENIED:
        console.log('采购权限不足');
        break;
      case SupplyChainErrorType.NETWORK_NOT_BUILT:
        console.log('供应链网络未构建');
        break;
    }
  }
}
```

## 📝 最佳实践

### 1. 系统初始化
```typescript
// 在应用启动时初始化系统
await supplyChainOptimizer.findOptimalPath('test_user', 'test_product', 1);
```

### 2. 错误恢复
```typescript
// 网络更新失败时的恢复策略
try {
  await supplyChainOptimizer.updateNetwork(userIds);
} catch (error) {
  // 增量更新失败，执行完整重建
  await networkBuilderService.buildSupplyChainGraph(true);
}
```

### 3. 性能优化
```typescript
// 对于频繁查询的商品，启用缓存
const path = await supplyChainOptimizer.findOptimalPath(
  buyerId, productId, quantity,
  { useCache: true }
);

// 对于不常用的查询，可以跳过缓存
const path = await supplyChainOptimizer.findOptimalPath(
  buyerId, productId, quantity,
  { useCache: false }
);
```

## 🔧 配置选项

```typescript
const config = {
  defaultAlgorithm: 'genetic_algorithm_optimization',
  maxSearchDepth: 10,
  maxPaths: 20,
  defaultWeights: {
    price: 0.35,
    inventory: 0.25,
    length: 0.20,
    reliability: 0.15,
    speed: 0.05
  },
  cache: {
    maxSize: 10000,
    maxMemory: 100 * 1024 * 1024, // 100MB
    defaultTtl: 300000, // 5分钟
    evictionPolicy: 'LRU'
  },
  performance: {
    enableMonitoring: true,
    maxExecutionTime: 10000,
    batchSize: 100
  }
};

const optimizer = new SupplyChainPathOptimizer(config);
```

## 📚 API 参考

详细API文档请参考类型定义文件 `types.ts`，包含所有接口、枚举和类的完整定义。

## 🤝 贡献

欢迎提交问题报告和功能请求。在提交代码之前，请确保：

1. 代码符合现有风格
2. 添加适当的测试
3. 更新相关文档
4. 通过所有性能测试

## 📄 许可证

本项目采用 MIT 许可证。