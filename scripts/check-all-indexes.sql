-- =====================================================
-- 检查所有表的索引状态
-- =====================================================

SET SESSION sql_mode = '';

SELECT
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS,
    NON_UNIQUE,
    INDEX_TYPE,
    CARDINALITY
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
    AND INDEX_NAME != 'PRIMARY'
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE, INDEX_TYPE, CARDINALITY
ORDER BY TABLE_NAME, INDEX_NAME;

-- =====================================================
-- 统计索引数量
-- =====================================================

SELECT
    TABLE_NAME,
    COUNT(DISTINCT INDEX_NAME) AS INDEX_COUNT
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
    AND INDEX_NAME != 'PRIMARY'
GROUP BY TABLE_NAME
ORDER BY INDEX_COUNT DESC;

-- =====================================================
-- 显示表大小和行数
-- =====================================================

SELECT
    TABLE_NAME,
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Size_MB',
    TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_TYPE = 'BASE TABLE'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;