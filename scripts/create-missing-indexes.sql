-- =====================================================
-- 中道商城数据库索引优化脚本（只创建缺失索引）
-- 创建日期: 2025-12-10
-- 目标: 优化高频查询，将响应时间减少50%以上
-- =====================================================

-- 设置SQL模式以避免索引创建时的某些问题
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- =====================================================
-- 1. 用户表相关索引优化
-- =====================================================

-- 用户层级查询优化（团队关系查询）
-- 检查并添加缺失的索引
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_teampath_level') > 0,
    'SELECT ''Index idx_users_teampath_level already exists'' as message;',
    'ALTER TABLE users ADD INDEX idx_users_teampath_level (teamPath, teamLevel);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_level_status_created') > 0,
    'SELECT ''Index idx_users_level_status_created already exists'' as message;',
    'ALTER TABLE users ADD INDEX idx_users_level_status_created (level, status, createdAt);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_totalsales_level') > 0,
    'SELECT ''Index idx_users_totalsales_level already exists'' as message;',
    'ALTER TABLE users ADD INDEX idx_users_totalsales_level (totalSales DESC, level);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_teamstats') > 0,
    'SELECT ''Index idx_users_teamstats already exists'' as message;',
    'ALTER TABLE users ADD INDEX idx_users_teamstats (teamSales DESC, teamCount DESC, directCount DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- 2. 积分交易表索引优化
-- =====================================================

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'pointsTransactions' AND index_name = 'idx_points_transactions_composite') > 0,
    'SELECT ''Index idx_points_transactions_composite already exists'' as message;',
    'ALTER TABLE pointsTransactions ADD INDEX idx_points_transactions_composite (toUserId, type, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'pointsTransactions' AND index_name = 'idx_points_transactions_from_composite') > 0,
    'SELECT ''Index idx_points_transactions_from_composite already exists'' as message;',
    'ALTER TABLE pointsTransactions ADD INDEX idx_points_transactions_from_composite (fromUserId, type, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'pointsTransactions' AND index_name = 'idx_points_transactions_status_time') > 0,
    'SELECT ''Index idx_points_transactions_status_time already exists'' as message;',
    'ALTER TABLE pointsTransactions ADD INDEX idx_points_transactions_status_time (status, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'pointsTransactions' AND index_name = 'idx_points_transactions_period') > 0,
    'SELECT ''Index idx_points_transactions_period already exists'' as message;',
    'ALTER TABLE pointsTransactions ADD INDEX idx_points_transactions_period (type, status, createdAt);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'pointsTransactions' AND index_name = 'idx_points_transactions_monthly') > 0,
    'SELECT ''Index idx_points_transactions_monthly already exists'' as message;',
    'ALTER TABLE pointsTransactions ADD INDEX idx_points_transactions_monthly (createdAt, type);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- 3. 订单表索引优化
-- =====================================================

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_buyer_time_status') > 0,
    'SELECT ''Index idx_orders_buyer_time_status already exists'' as message;',
    'ALTER TABLE orders ADD INDEX idx_orders_buyer_time_status (buyerId, createdAt DESC, status);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_seller_time_status') > 0,
    'SELECT ''Index idx_orders_seller_time_status already exists'' as message;',
    'ALTER TABLE orders ADD INDEX idx_orders_seller_time_status (sellerId, createdAt DESC, status);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_status_payment_time') > 0,
    'SELECT ''Index idx_orders_status_payment_time already exists'' as message;',
    'ALTER TABLE orders ADD INDEX idx_orders_status_payment_time (status, paymentStatus, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_type_time') > 0,
    'SELECT ''Index idx_orders_type_time already exists'' as message;',
    'ALTER TABLE orders ADD INDEX idx_orders_type_time (type, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_monthly_stats') > 0,
    'SELECT ''Index idx_orders_monthly_stats already exists'' as message;',
    'ALTER TABLE orders ADD INDEX idx_orders_monthly_stats (createdAt, status, totalAmount);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- 4. 产品表索引优化
-- =====================================================

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'products' AND index_name = 'idx_products_category_status_sort') > 0,
    'SELECT ''Index idx_products_category_status_sort already exists'' as message;',
    'ALTER TABLE products ADD INDEX idx_products_category_status_sort (categoryId, status, sort, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'products' AND index_name = 'idx_products_status_featured_sort') > 0,
    'SELECT ''Index idx_products_status_featured_sort already exists'' as message;',
    'ALTER TABLE products ADD INDEX idx_products_status_featured_sort (status, isFeatured, sort, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'products' AND index_name = 'idx_products_price_range') > 0,
    'SELECT ''Index idx_products_price_range already exists'' as message;',
    'ALTER TABLE products ADD INDEX idx_products_price_range (basePrice, status);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'products' AND index_name = 'idx_products_stock_status') > 0,
    'SELECT ''Index idx_products_stock_status already exists'' as message;',
    'ALTER TABLE products ADD INDEX idx_products_stock_status (totalStock, status);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'products' AND index_name = 'idx_products_name_search') > 0,
    'SELECT ''Index idx_products_name_search already exists'' as message;',
    'ALTER TABLE products ADD INDEX idx_products_name_search (name(100));'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'products' AND index_name = 'idx_products_shop_status') > 0,
    'SELECT ''Index idx_products_shop_status already exists'' as message;',
    'ALTER TABLE products ADD INDEX idx_products_shop_status (shopId, status, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- 5. 产品分类和标签索引
-- =====================================================

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'productCategories' AND index_name = 'idx_categories_parent_active_sort') > 0,
    'SELECT ''Index idx_categories_parent_active_sort already exists'' as message;',
    'ALTER TABLE productCategories ADD INDEX idx_categories_parent_active_sort (parentId, isActive, sort);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'productCategories' AND index_name = 'idx_categories_level_active') > 0,
    'SELECT ''Index idx_categories_level_active already exists'' as message;',
    'ALTER TABLE productCategories ADD INDEX idx_categories_level_active (level, isActive);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'productTags' AND index_name = 'idx_product_tags_composite') > 0,
    'SELECT ''Index idx_product_tags_composite already exists'' as message;',
    'ALTER TABLE productTags ADD INDEX idx_product_tags_composite (name, sort);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- 6. 库存相关索引优化
-- =====================================================

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'inventoryLogs' AND index_name = 'idx_inventory_logs_product_time') > 0,
    'SELECT ''Index idx_inventory_logs_product_time already exists'' as message;',
    'ALTER TABLE inventoryLogs ADD INDEX idx_inventory_logs_product_time (productId, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'inventoryLogs' AND index_name = 'idx_inventory_logs_user_time_type') > 0,
    'SELECT ''Index idx_inventory_logs_user_time_type already exists'' as message;',
    'ALTER TABLE inventoryLogs ADD INDEX idx_inventory_logs_user_time_type (userId, createdAt DESC, operationType);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'inventoryLogs' AND index_name = 'idx_inventory_logs_warehouse_time') > 0,
    'SELECT ''Index idx_inventory_logs_warehouse_time already exists'' as message;',
    'ALTER TABLE inventoryLogs ADD INDEX idx_inventory_logs_warehouse_time (warehouseType, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'inventoryAlerts' AND index_name = 'idx_inventory_alerts_unresolved') > 0,
    'SELECT ''Index idx_inventory_alerts_unresolved already exists'' as message;',
    'ALTER TABLE inventoryAlerts ADD INDEX idx_inventory_alerts_unresolved (isResolved, isRead, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'inventoryAlerts' AND index_name = 'idx_inventory_alerts_type_warehouse') > 0,
    'SELECT ''Index idx_inventory_alerts_type_warehouse already exists'' as message;',
    'ALTER TABLE inventoryAlerts ADD INDEX idx_inventory_alerts_type_warehouse (alertType, warehouseType, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'inventoryStocks' AND index_name = 'idx_inventory_stocks_product_warehouse') > 0,
    'SELECT ''Index idx_inventory_stocks_product_warehouse already exists'' as message;',
    'ALTER TABLE inventoryStocks ADD INDEX idx_inventory_stocks_product_warehouse (productId, warehouseType);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'inventoryStocks' AND index_name = 'idx_inventory_stocks_quantity') > 0,
    'SELECT ''Index idx_inventory_stocks_quantity already exists'' as message;',
    'ALTER TABLE inventoryStocks ADD INDEX idx_inventory_stocks_quantity (quantity, availableQuantity);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- 7. 团队和业绩索引
-- =====================================================

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'teamMembers' AND index_name = 'idx_team_members_team_status') > 0,
    'SELECT ''Index idx_team_members_team_status already exists'' as message;',
    'ALTER TABLE teamMembers ADD INDEX idx_team_members_team_status (teamId, status, joinDate DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'teamMembers' AND index_name = 'idx_team_members_user_role') > 0,
    'SELECT ''Index idx_team_members_user_role already exists'' as message;',
    'ALTER TABLE teamMembers ADD INDEX idx_team_members_user_role (userId, role);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'referralRelationships' AND index_name = 'idx_referral_relationships_path') > 0,
    'SELECT ''Index idx_referral_relationships_path already exists'' as message;',
    'ALTER TABLE referralRelationships ADD INDEX idx_referral_relationships_path (path, isActive);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'performanceMetrics' AND index_name = 'idx_performance_metrics_user_period') > 0,
    'SELECT ''Index idx_performance_metrics_user_period already exists'' as message;',
    'ALTER TABLE performanceMetrics ADD INDEX idx_performance_metrics_user_period (userId, period DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'performanceMetrics' AND index_name = 'idx_performance_metrics_role_performance') > 0,
    'SELECT ''Index idx_performance_metrics_role_performance already exists'' as message;',
    'ALTER TABLE performanceMetrics ADD INDEX idx_performance_metrics_role_performance (currentRole, personalSales DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- 8. 佣金计算索引
-- =====================================================

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'commissionCalculations' AND index_name = 'idx_commission_calculations_user_status') > 0,
    'SELECT ''Index idx_commission_calculations_user_status already exists'' as message;',
    'ALTER TABLE commissionCalculations ADD INDEX idx_commission_calculations_user_status (userId, status, calculatedAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'commissionCalculations' AND index_name = 'idx_commission_calculations_period_status') > 0,
    'SELECT ''Index idx_commission_calculations_period_status already exists'' as message;',
    'ALTER TABLE commissionCalculations ADD INDEX idx_commission_calculations_period_status (period, status, totalCommission DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- 9. 支付相关索引
-- =====================================================

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'paymentRecords' AND index_name = 'idx_payment_records_user_status_time') > 0,
    'SELECT ''Index idx_payment_records_user_status_time already exists'' as message;',
    'ALTER TABLE paymentRecords ADD INDEX idx_payment_records_user_status_time (userId, status, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'paymentRecords' AND index_name = 'idx_payment_records_channel_time') > 0,
    'SELECT ''Index idx_payment_records_channel_time already exists'' as message;',
    'ALTER TABLE paymentRecords ADD INDEX idx_payment_records_channel_time (paymentChannel, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'paymentRecords' AND index_name = 'idx_payment_records_order_status') > 0,
    'SELECT ''Index idx_payment_records_order_status already exists'' as message;',
    'ALTER TABLE paymentRecords ADD INDEX idx_payment_records_order_status (orderId, status);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'paymentLogs' AND index_name = 'idx_payment_logs_payment_action_time') > 0,
    'SELECT ''Index idx_payment_logs_payment_action_time already exists'' as message;',
    'ALTER TABLE paymentLogs ADD INDEX idx_payment_logs_payment_action_time (paymentId, action, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- 10. 通知相关索引
-- =====================================================

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'notifications' AND index_name = 'idx_notifications_recipient_status') > 0,
    'SELECT ''Index idx_notifications_recipient_status already exists'' as message;',
    'ALTER TABLE notifications ADD INDEX idx_notifications_recipient_status (recipientId, status, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'notifications' AND index_name = 'idx_notifications_unread') > 0,
    'SELECT ''Index idx_notifications_unread already exists'' as message;',
    'ALTER TABLE notifications ADD INDEX idx_notifications_unread (recipientId, isRead, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'notifications' AND index_name = 'idx_notifications_category_time') > 0,
    'SELECT ''Index idx_notifications_category_time already exists'' as message;',
    'ALTER TABLE notifications ADD INDEX idx_notifications_category_time (category, createdAt DESC);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- 11. 系统配置索引
-- =====================================================

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'systemConfigs' AND index_name = 'idx_system_configs_category') > 0,
    'SELECT ''Index idx_system_configs_category already exists'' as message;',
    'ALTER TABLE systemConfigs ADD INDEX idx_system_configs_category (category, key);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'systemConfigs' AND index_name = 'idx_system_configs_editable') > 0,
    'SELECT ''Index idx_system_configs_editable already exists'' as message;',
    'ALTER TABLE systemConfigs ADD INDEX idx_system_configs_editable (isEditable, category);'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;