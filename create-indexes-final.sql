-- 为积分交易记录API性能优化创建必要的索引
-- 执行时间: 2025-12-09
-- MySQL版本 - 使用正确的表名 pointsTransactions

-- 1. 复合索引: 优化 fromUserId + toUserId + createdAt DESC 查询
CREATE INDEX idx_points_transactions_from_to_created ON pointsTransactions(fromUserId, toUserId, createdAt DESC);

-- 2. 单列索引: 优化 fromUserId + createdAt DESC 查询
CREATE INDEX idx_points_transactions_from_created ON pointsTransactions(fromUserId, createdAt DESC);

-- 3. 单列索引: 优化 toUserId + createdAt DESC 查询
CREATE INDEX idx_points_transactions_to_created ON pointsTransactions(toUserId, createdAt DESC);

-- 4. 额外的性能优化索引
CREATE INDEX idx_points_transactions_type_created ON pointsTransactions(type, createdAt DESC);
CREATE INDEX idx_points_transactions_status_created ON pointsTransactions(status, createdAt DESC);