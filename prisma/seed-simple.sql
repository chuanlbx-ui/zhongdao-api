-- 插入基础系统配置
INSERT INTO SystemConfig (id, category, key, value, description, isActive, createdAt, updatedAt) VALUES
('001', 'user', 'defaultLevel', 'NORMAL', '默认用户等级', TRUE, NOW(), NOW()),
('002', 'commission', 'rate', '0.1', '默认佣金比例', TRUE, NOW(), NOW()),
('003', 'points', 'exchangeRate', '100', '积分兑换比例', TRUE, NOW(), NOW());

-- 插入测试用户
INSERT INTO User (id, mobile, wechatOpenId, nickname, avatar, level, isActive, isEmailVerified, isPhoneVerified, createdAt, updatedAt) VALUES
('admin-001', '13800138000', 'admin_openid', '系统管理员', '', 'ADMIN', TRUE, TRUE, TRUE, NOW(), NOW()),
('test-001', '13800138001', 'test_openid_1', '测试用户1', '', 'NORMAL', TRUE, TRUE, TRUE, NOW(), NOW()),
('test-002', '13800138002', 'test_openid_2', '测试用户2', '', 'VIP', TRUE, TRUE, TRUE, NOW(), NOW()),
('test-003', '13800138003', 'test_openid_3', '测试用户3', '', 'STAR_1', TRUE, TRUE, TRUE, NOW(), NOW());