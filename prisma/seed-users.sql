-- 插入测试用户数据
INSERT INTO users (id, openid, nickname, phone, avatarUrl, level, status, parentId, teamPath, teamLevel, totalSales, totalBottles, directSales, teamSales, directCount, teamCount, pointsBalance, pointsFrozen, createdAt, updatedAt, referralCode) VALUES
-- 管理员
('cm0p3y7k000001qxrx7t8b1xr', 'admin_openid_001', '系统管理员', '13800138000', 'https://ui-avatars.com/api/?name=Admin&background=random', 'DIRECTOR', 'ACTIVE', NULL, NULL, 1, 0, 0, 0, 0, 0, 0, 100000, 0, NOW(), NOW(), 'ADMIN01'),

-- VIP用户
('cm0p3y7k000001qxrx7t8b1xs', 'user_001', '张三', '13800138001', 'https://ui-avatars.com/api/?name=张三&background=1890ff', 'VIP', 'ACTIVE', 'cm0p3y7k000001qxrx7t8b1xr', 'cm0p3y7k000001qxrx7t8b1xr', 2, 5000, 50, 5000, 5000, 5, 10, 1000, 0, NOW(), NOW(), 'USER001'),
('cm0p3y7k000001qxrx7t8b1xt', 'user_002', '李四', '13800138002', 'https://ui-avatars.com/api/?name=李四&background=52c41a', 'VIP', 'ACTIVE', 'cm0p3y7k000001qxrx7t8b1xr', 'cm0p3y7k000001qxrx7t8b1xr', 2, 3000, 30, 3000, 3000, 3, 6, 800, 0, NOW(), NOW(), 'USER002'),

-- 一星店长
('cm0p3y7k000001qxrx7t8b1xu', 'user_003', '王五', '13800138003', 'https://ui-avatars.com/api/?name=王五&background=faad14', 'STAR_1', 'ACTIVE', 'cm0p3y7k000001qxrx7t8b1xr', 'cm0p3y7k000001qxrx7t8b1xr', 2, 15000, 150, 15000, 15000, 15, 30, 3000, 0, NOW(), NOW(), 'USER003'),
('cm0p3y7k000001qxrx7t8b1xv', 'user_004', '赵六', '13800138004', 'https://ui-avatars.com/api/?name=赵六&background=faad14', 'STAR_1', 'ACTIVE', 'cm0p3y7k000001qxrx7t8b1xr', 'cm0p3y7k000001qxrx7t8b1xr', 2, 12000, 120, 12000, 12000, 12, 25, 2500, 0, NOW(), NOW(), 'USER004'),

-- 二星店长
('cm0p3y7k000001qxrx7t8b1xw', 'user_005', '钱七', '13800138005', 'https://ui-avatars.com/api/?name=钱七&background=13c2c2', 'STAR_2', 'ACTIVE', 'cm0p3y7k000001qxrx7t8b1xr', 'cm0p3y7k000001qxrx7t8b1xr', 2, 50000, 500, 50000, 50000, 25, 60, 8000, 0, NOW(), NOW(), 'USER005'),
('cm0p3y7k000001qxrx7t8b1xx', 'user_006', '孙八', '13800138006', 'https://ui-avatars.com/api/?name=孙八&background=13c2c2', 'STAR_2', 'ACTIVE', 'cm0p3y7k000001qxrx7t8b1xr', 'cm0p3y7k000001qxrx7t8b1xr', 2, 45000, 450, 45000, 45000, 20, 50, 7000, 0, NOW(), NOW(), 'USER006'),

-- 三星店长
('cm0p3y7k000001qxrx7t8b1xy', 'user_007', '周九', '13800138007', 'https://ui-avatars.com/api/?name=周九&background=52c41a', 'STAR_3', 'ACTIVE', 'cm0p3y7k000001qxrx7t8b1xr', 'cm0p3y7k000001qxrx7t8b1xr', 2, 120000, 1200, 120000, 120000, 40, 100, 15000, 0, NOW(), NOW(), 'USER007'),

-- 普通用户
('cm0p3y7k000001qxrx7t8b1xz', 'user_008', '吴十', '13800138008', 'https://ui-avatars.com/api/?name=吴十&background=8c8c8c', 'NORMAL', 'ACTIVE', 'cm0p3y7k000001qxrx7t8b1xs', 'cm0p3y7k000001qxrx7t8b1xr,cm0p3y7k000001qxrx7t8b1xs', 3, 500, 5, 500, 500, 1, 2, 100, 0, NOW(), NOW(), 'USER008'),
('cm0p3y7k000001qxrx7t8b1y0', 'user_009', '郑十一', '13800138009', 'https://ui-avatars.com/api/?name=郑十一&background=8c8c8c', 'NORMAL', 'ACTIVE', 'cm0p3y7k000001qxrx7t8b1xs', 'cm0p3y7k000001qxrx7t8b1xr,cm0p3y7k000001qxrx7t8b1xs', 3, 300, 3, 300, 300, 0, 1, 50, 0, NOW(), NOW(), 'USER009'),
('cm0p3y7k000001qxrx7t8b1y1', 'user_010', '林十二', '13800138010', 'https://ui-avatars.com/api/?name=林十二&background=8c8c8c', 'NORMAL', 'ACTIVE', 'cm0p3y7k000001qxrx7t8b1xs', 'cm0p3y7k000001qxrx7t8b1xr,cm0p3y7k000001qxrx7t8b1xs', 3, 800, 8, 800, 800, 2, 4, 150, 0, NOW(), NOW(), 'USER010'),

-- 更多普通用户
('cm0p3y7k000001qxrx7t8b1y2', 'user_011', '陈十三', '13800138011', NULL, 'NORMAL', 'ACTIVE', NULL, NULL, 1, 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW(), 'USER011'),
('cm0p3y7k000001qxrx7t8b1y3', 'user_012', '黄十四', '13800138012', NULL, 'NORMAL', 'ACTIVE', NULL, NULL, 1, 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW(), 'USER012'),
('cm0p3y7k000001qxrx7t8b1y4', 'user_013', '刘十五', '13800138013', NULL, 'NORMAL', 'ACTIVE', NULL, NULL, 1, 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW(), 'USER013');

-- 更新统计信息
UPDATE users SET
  updatedAt = NOW();