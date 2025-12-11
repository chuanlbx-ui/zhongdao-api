-- =====================================================
-- 中道商城数据库索引优化脚本
-- 创建日期: 2025-12-10
-- 目标: 优化高频查询，将响应时间减少50%以上
-- =====================================================

-- 设置SQL模式以避免索引创建时的某些问题
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- =====================================================
-- 1. 用户表相关索引优化
-- =====================================================

-- 用户层级查询优化（团队关系查询）
-- 用于: parentId查询、teamPath查询、用户层级统计
CREATE INDEX IF NOT EXISTS idx_users_parentid_status ON users(parentId, status);
CREATE INDEX IF NOT EXISTS idx_users_teampath_level ON users(teamPath(255), teamLevel);
CREATE INDEX IF NOT EXISTS idx_users_level_status_created ON users(level, status, createdAt);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referralCode);
CREATE INDEX IF NOT EXISTS idx_users_phone_id ON users(phone, id);

-- 用户业绩统计索引
-- 用于: 业绩查询、排行榜统计
CREATE INDEX IF NOT EXISTS idx_users_totalsales_level ON users(totalSales DESC, level);
CREATE INDEX IF NOT EXISTS idx_users_teamstats ON users(teamSales DESC, teamCount DESC, directCount DESC);

-- =====================================================
-- 2. 积分交易表索引优化
-- =====================================================

-- 积分流水查询优化（已存在部分索引，补充复合索引）
-- 用于: 用户积分流水查询、财务对账
CREATE INDEX IF NOT EXISTS idx_points_transactions_composite ON pointsTransactions(toUserId, type, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_points_transactions_from_composite ON pointsTransactions(fromUserId, type, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_points_transactions_status_time ON pointsTransactions(status, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_points_transactions_period ON pointsTransactions(type, status, createdAt);

-- 积分月度统计索引
-- 用于: 财务报表、月度对账
CREATE INDEX IF NOT EXISTS idx_points_transactions_monthly ON pointsTransactions(
    YEAR(createdAt),
    MONTH(createdAt),
    type
);

-- =====================================================
-- 3. 订单表索引优化
-- =====================================================

-- 订单查询优化（已存在部分索引，补充复合索引）
-- 用于: 用户订单列表、商家订单管理
CREATE INDEX IF NOT EXISTS idx_orders_buyer_time_status ON orders(buyerId, createdAt DESC, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_time_status ON orders(sellerId, createdAt DESC, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_payment_time ON orders(status, paymentStatus, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_orders_type_time ON orders(type, createdAt DESC);

-- 订单统计索引
-- 用于: 销售报表、订单统计
CREATE INDEX IF NOT EXISTS idx_orders_monthly_stats ON orders(
    YEAR(createdAt),
    MONTH(createdAt),
    status,
    totalAmount
);

-- =====================================================
-- 4. 产品表索引优化
-- =====================================================

-- 产品查询优化（已存在部分索引，补充复合索引）
-- 用于: 商品列表、分类商品、商品搜索
CREATE INDEX IF NOT EXISTS idx_products_category_status_sort ON products(categoryId, status, sort, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_products_status_featured_sort ON products(status, isFeatured, sort, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_products_price_range ON products(basePrice, status);
CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(totalStock, status);
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products(name(100));

-- 商店商品索引
-- 用于: 商店商品管理
CREATE INDEX IF NOT EXISTS idx_products_shop_status ON products(shopId, status, createdAt DESC);

-- =====================================================
-- 5. 产品分类和标签索引
-- =====================================================

-- 分类层级查询优化（已存在基础索引）
-- 用于: 分类树查询、分类商品统计
CREATE INDEX IF NOT EXISTS idx_categories_parent_active_sort ON productCategories(parentId, isActive, sort);
CREATE INDEX IF NOT EXISTS idx_categories_level_active ON productCategories(level, isActive);

-- 标签查询优化（已存在基础索引）
-- 用于: 标签商品查询
CREATE INDEX IF NOT EXISTS idx_product_tags_composite ON productTags(name, sort);

-- =====================================================
-- 6. 库存相关索引优化
-- =====================================================

-- 库存日志查询优化（已存在部分索引，补充复合索引）
-- 用于: 库存变动记录、库存统计
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_time ON inventoryLogs(productId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_user_time_type ON inventoryLogs(userId, createdAt DESC, operationType);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_warehouse_time ON inventoryLogs(warehouseType, createdAt DESC);

-- 库存预警索引
-- 用于: 库存预警查询
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_unresolved ON inventoryAlerts(isResolved, isRead, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_type_warehouse ON inventoryAlerts(alertType, warehouseType, createdAt DESC);

-- 库存统计索引
-- 用于: 库存报表、库存分析
CREATE INDEX IF NOT EXISTS idx_inventory_stocks_product_warehouse ON inventoryStocks(productId, warehouseType);
CREATE INDEX IF NOT EXISTS idx_inventory_stocks_quantity ON inventoryStocks(quantity, availableQuantity);

-- =====================================================
-- 7. 团队和业绩索引
-- =====================================================

-- 团队关系索引
-- 用于: 团队成员查询、层级关系
CREATE INDEX IF NOT EXISTS idx_team_members_team_status ON teamMembers(teamId, status, joinDate DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_user_role ON teamMembers(userId, role);
CREATE INDEX IF NOT EXISTS idx_referral_relationships_path ON referralRelationships(path(255), isActive);

-- 业绩统计索引
-- 用于: 业绩报表、排行榜
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_period ON performanceMetrics(userId, period DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_role_performance ON performanceMetrics(currentRole, personalSales DESC);

-- =====================================================
-- 8. 佣金计算索引
-- =====================================================

-- 佣金查询优化
-- 用于: 佣金统计、佣金发放
CREATE INDEX IF NOT EXISTS idx_commission_calculations_user_status ON commissionCalculations(userId, status, calculatedAt DESC);
CREATE INDEX IF NOT EXISTS idx_commission_calculations_period_status ON commissionCalculations(period, status, totalCommission DESC);

-- =====================================================
-- 9. 支付相关索引
-- =====================================================

-- 支付记录索引
-- 用于: 支付查询、财务对账
CREATE INDEX IF NOT EXISTS idx_payment_records_user_status_time ON paymentRecords(userId, status, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_payment_records_channel_time ON paymentRecords(paymentChannel, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_payment_records_order_status ON paymentRecords(orderId, status);

-- 支付日志索引
-- 用于: 支付日志查询、问题排查
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_action_time ON paymentLogs(paymentId, action, createdAt DESC);

-- =====================================================
-- 10. 通知相关索引
-- =====================================================

-- 通知查询优化
-- 用于: 用户通知列表、通知统计
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_status ON notifications(recipientId, status, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipientId, isRead, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category_time ON notifications(category, createdAt DESC);

-- =====================================================
-- 11. 系统配置索引
-- =====================================================

-- 配置查询优化
-- 用于: 系统配置缓存、配置更新
CREATE INDEX IF NOT EXISTS idx_system_configs_category ON systemConfigs(category, key);
CREATE INDEX IF NOT EXISTS idx_system_configs_editable ON systemConfigs(isEditable, category);

-- =====================================================
-- 索引创建完成后的分析和优化建议
-- =====================================================

-- 分析表以更新索引统计信息
ANALYZE TABLE users;
ANALYZE TABLE pointsTransactions;
ANALYZE TABLE orders;
ANALYZE TABLE products;
ANALYZE TABLE productCategories;
ANALYZE TABLE inventoryLogs;
ANALYZE TABLE inventoryAlerts;
ANALYZE TABLE inventoryStocks;
ANALYZE TABLE teamMembers;
ANALYZE TABLE referralRelationships;
ANALYZE TABLE performanceMetrics;
ANALYZE TABLE commissionCalculations;
ANALYZE TABLE paymentRecords;
ANALYZE TABLE paymentLogs;
ANALYZE TABLE notifications;
ANALYZE TABLE systemConfigs;

-- =====================================================
-- 性能监控查询
-- =====================================================

-- 查看索引使用情况的监控查询（定期执行）
-- SELECT
--     TABLE_NAME,
--     INDEX_NAME,
--     CARDINALITY,
--     SUB_PART,
--     PACKED,
--     NULLABLE,
--     INDEX_TYPE
-- FROM information_schema.STATISTICS
-- WHERE TABLE_SCHEMA = DATABASE()
-- ORDER BY TABLE_NAME, SEQ_IN_INDEX;

-- 查看未使用的索引（每月检查一次）
-- SELECT
--     OBJECT_SCHEMA,
--     OBJECT_NAME,
--     INDEX_NAME
-- FROM performance_schema.table_io_waits_summary_by_index_usage
-- WHERE OBJECT_SCHEMA = DATABASE()
--     AND COUNT_STAR = 0
--     AND INDEX_NAME IS NOT NULL;

-- =====================================================
-- 注意事项
-- =====================================================

-- 1. 这些索引会增加写入开销，但会大幅提升读取性能
-- 2. 定期监控索引使用情况，移除未使用的索引
-- 3. 对于大表，索引创建可能需要时间，建议在低峰期执行
-- 4. 索引会占用额外存储空间，评估存储容量
-- 5. 考虑使用查询缓存进一步优化性能

-- =====================================================
-- 执行建议
-- =====================================================

-- 1. 分批执行索引创建，避免长时间锁表
-- 2. 在生产环境执行前，先在测试环境验证
-- 3. 执行前备份重要数据
-- 4. 监控执行过程中的系统性能
-- 5. 执行后验证索引是否正确创建