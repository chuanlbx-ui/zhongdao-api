-- =====================================================
-- 中道商城数据库索引优化脚本（安全版本）
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
ALTER TABLE users ADD INDEX idx_users_parentid_status (parentId, status);
ALTER TABLE users ADD INDEX idx_users_teampath_level (teamPath, teamLevel);
ALTER TABLE users ADD INDEX idx_users_level_status_created (level, status, createdAt);
ALTER TABLE users ADD INDEX idx_users_referral_code (referralCode);
ALTER TABLE users ADD INDEX idx_users_phone_id (phone, id);

-- 用户业绩统计索引
-- 用于: 业绩查询、排行榜统计
ALTER TABLE users ADD INDEX idx_users_totalsales_level (totalSales DESC, level);
ALTER TABLE users ADD INDEX idx_users_teamstats (teamSales DESC, teamCount DESC, directCount DESC);

-- =====================================================
-- 2. 积分交易表索引优化
-- =====================================================

-- 积分流水查询优化（已存在部分索引，补充复合索引）
-- 用于: 用户积分流水查询、财务对账
ALTER TABLE pointsTransactions ADD INDEX idx_points_transactions_composite (toUserId, type, createdAt DESC);
ALTER TABLE pointsTransactions ADD INDEX idx_points_transactions_from_composite (fromUserId, type, createdAt DESC);
ALTER TABLE pointsTransactions ADD INDEX idx_points_transactions_status_time (status, createdAt DESC);
ALTER TABLE pointsTransactions ADD INDEX idx_points_transactions_period (type, status, createdAt);

-- 积分月度统计索引
-- 用于: 财务报表、月度对账
ALTER TABLE pointsTransactions ADD INDEX idx_points_transactions_monthly (
    YEAR(createdAt),
    MONTH(createdAt),
    type
);

-- =====================================================
-- 3. 订单表索引优化
-- =====================================================

-- 订单查询优化（已存在部分索引，补充复合索引）
-- 用于: 用户订单列表、商家订单管理
ALTER TABLE orders ADD INDEX idx_orders_buyer_time_status (buyerId, createdAt DESC, status);
ALTER TABLE orders ADD INDEX idx_orders_seller_time_status (sellerId, createdAt DESC, status);
ALTER TABLE orders ADD INDEX idx_orders_status_payment_time (status, paymentStatus, createdAt DESC);
ALTER TABLE orders ADD INDEX idx_orders_type_time (type, createdAt DESC);

-- 订单统计索引
-- 用于: 销售报表、订单统计
ALTER TABLE orders ADD INDEX idx_orders_monthly_stats (
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
ALTER TABLE products ADD INDEX idx_products_category_status_sort (categoryId, status, sort, createdAt DESC);
ALTER TABLE products ADD INDEX idx_products_status_featured_sort (status, isFeatured, sort, createdAt DESC);
ALTER TABLE products ADD INDEX idx_products_price_range (basePrice, status);
ALTER TABLE products ADD INDEX idx_products_stock_status (totalStock, status);
ALTER TABLE products ADD INDEX idx_products_name_search (name(100));

-- 商店商品索引
-- 用于: 商店商品管理
ALTER TABLE products ADD INDEX idx_products_shop_status (shopId, status, createdAt DESC);

-- =====================================================
-- 5. 产品分类和标签索引
-- =====================================================

-- 分类层级查询优化（已存在基础索引）
-- 用于: 分类树查询、分类商品统计
ALTER TABLE productCategories ADD INDEX idx_categories_parent_active_sort (parentId, isActive, sort);
ALTER TABLE productCategories ADD INDEX idx_categories_level_active (level, isActive);

-- 标签查询优化（已存在基础索引）
-- 用于: 标签商品查询
ALTER TABLE productTags ADD INDEX idx_product_tags_composite (name, sort);

-- =====================================================
-- 6. 库存相关索引优化
-- =====================================================

-- 库存日志查询优化（已存在部分索引，补充复合索引）
-- 用于: 库存变动记录、库存统计
ALTER TABLE inventoryLogs ADD INDEX idx_inventory_logs_product_time (productId, createdAt DESC);
ALTER TABLE inventoryLogs ADD INDEX idx_inventory_logs_user_time_type (userId, createdAt DESC, operationType);
ALTER TABLE inventoryLogs ADD INDEX idx_inventory_logs_warehouse_time (warehouseType, createdAt DESC);

-- 库存预警索引
-- 用于: 库存预警查询
ALTER TABLE inventoryAlerts ADD INDEX idx_inventory_alerts_unresolved (isResolved, isRead, createdAt DESC);
ALTER TABLE inventoryAlerts ADD INDEX idx_inventory_alerts_type_warehouse (alertType, warehouseType, createdAt DESC);

-- 库存统计索引
-- 用于: 库存报表、库存分析
ALTER TABLE inventoryStocks ADD INDEX idx_inventory_stocks_product_warehouse (productId, warehouseType);
ALTER TABLE inventoryStocks ADD INDEX idx_inventory_stocks_quantity (quantity, availableQuantity);

-- =====================================================
-- 7. 团队和业绩索引
-- =====================================================

-- 团队关系索引
-- 用于: 团队成员查询、层级关系
ALTER TABLE teamMembers ADD INDEX idx_team_members_team_status (teamId, status, joinDate DESC);
ALTER TABLE teamMembers ADD INDEX idx_team_members_user_role (userId, role);
ALTER TABLE referralRelationships ADD INDEX idx_referral_relationships_path (path, isActive);

-- 业绩统计索引
-- 用于: 业绩报表、排行榜
ALTER TABLE performanceMetrics ADD INDEX idx_performance_metrics_user_period (userId, period DESC);
ALTER TABLE performanceMetrics ADD INDEX idx_performance_metrics_role_performance (currentRole, personalSales DESC);

-- =====================================================
-- 8. 佣金计算索引
-- =====================================================

-- 佣金查询优化
-- 用于: 佣金统计、佣金发放
ALTER TABLE commissionCalculations ADD INDEX idx_commission_calculations_user_status (userId, status, calculatedAt DESC);
ALTER TABLE commissionCalculations ADD INDEX idx_commission_calculations_period_status (period, status, totalCommission DESC);

-- =====================================================
-- 9. 支付相关索引
-- =====================================================

-- 支付记录索引
-- 用于: 支付查询、财务对账
ALTER TABLE paymentRecords ADD INDEX idx_payment_records_user_status_time (userId, status, createdAt DESC);
ALTER TABLE paymentRecords ADD INDEX idx_payment_records_channel_time (paymentChannel, createdAt DESC);
ALTER TABLE paymentRecords ADD INDEX idx_payment_records_order_status (orderId, status);

-- 支付日志索引
-- 用于: 支付日志查询、问题排查
ALTER TABLE paymentLogs ADD INDEX idx_payment_logs_payment_action_time (paymentId, action, createdAt DESC);

-- =====================================================
-- 10. 通知相关索引
-- =====================================================

-- 通知查询优化
-- 用于: 用户通知列表、通知统计
ALTER TABLE notifications ADD INDEX idx_notifications_recipient_status (recipientId, status, createdAt DESC);
ALTER TABLE notifications ADD INDEX idx_notifications_unread (recipientId, isRead, createdAt DESC);
ALTER TABLE notifications ADD INDEX idx_notifications_category_time (category, createdAt DESC);

-- =====================================================
-- 11. 系统配置索引
-- =====================================================

-- 配置查询优化
-- 用于: 系统配置缓存、配置更新
ALTER TABLE systemConfigs ADD INDEX idx_system_configs_category (category, key);
ALTER TABLE systemConfigs ADD INDEX idx_system_configs_editable (isEditable, category);

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