/**
 * 输入验证单元测试
 */

import { describe, it, expect } from 'vitest';

// 验证工具函数示例
describe('输入验证工具', () => {
  // 邮箱验证
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 密码强度验证
  const validatePassword = (password: string): {
    isValid: boolean;
    errors: string[];
  } => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('密码长度至少8位');
    }

    if (password.length > 20) {
      errors.push('密码长度不能超过20位');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }

    if (!/\d/.test(password)) {
      errors.push('密码必须包含数字');
    }

    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('密码必须包含特殊字符');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // 用户名验证
  const isValidUsername = (username: string): boolean => {
    // 4-20位，只能包含字母、数字、下划线、中文
    const usernameRegex = /^[\w\u4e00-\u9fa5]{4,20}$/;
    return usernameRegex.test(username);
  };

  // 金额验证
  const isValidAmount = (amount: string | number): boolean => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num) || num < 0) return false;
    // 最多两位小数
    return /^\d+(\.\d{1,2})?$/.test(num.toString());
  };

  // 手机号验证（中国大陆）
  const isValidPhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  // 身份证号验证（简单版）
  const isValidIdCard = (idCard: string): boolean => {
    // 18位身份证正则
    const idCardRegex = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
    return idCardRegex.test(idCard);
  };

  // URL验证
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // 日期格式验证
  const isValidDate = (date: string, format = 'YYYY-MM-DD'): boolean => {
    if (format === 'YYYY-MM-DD') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) return false;

      const d = new Date(date);
      return d instanceof Date && !isNaN(d.getTime());
    }
    return false;
  };

  // SKU验证
  const isValidSKU = (sku: string): boolean => {
    // SKU格式：2-3位字母 + 3-8位数字
    const skuRegex = /^[A-Z]{2,3}\d{3,8}$/;
    return skuRegex.test(sku);
  };

  // 订单号验证
  const isValidOrderNo = (orderNo: string): boolean => {
    // 订单号格式：ZD + 14位时间戳 + 3位随机数
    const orderNoRegex = /^ZD\d{17}$/;
    return orderNoRegex.test(orderNo);
  };

  describe('isValidEmail', () => {
    it('应该验证有效的邮箱', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('user123@test-domain.com')).toBe(true);
    });

    it('应该拒绝无效的邮箱', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user..name@domain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('应该验证强密码', () => {
      const result = validatePassword('StrongP@ssw0rd');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该识别弱密码', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('密码长度至少8位');
      expect(result.errors).toContain('密码必须包含大写字母');
      expect(result.errors).toContain('密码必须包含数字');
      expect(result.errors).toContain('密码必须包含特殊字符');
    });

    it('应该检查密码长度', () => {
      expect(validatePassword('Short1!').isValid).toBe(false);
      expect(validatePassword('ThisPasswordIsWayTooLong123!').isValid).toBe(false);
    });
  });

  describe('isValidUsername', () => {
    it('应该验证有效的用户名', () => {
      expect(isValidUsername('testuser')).toBe(true);
      expect(isValidUsername('user_name')).toBe(true);
      expect(isValidUsername('用户123')).toBe(true);
      expect(isValidUsername('test用户')).toBe(true);
    });

    it('应该拒绝无效的用户名', () => {
      expect(isValidUsername('a')).toBe(false); // 太短
      expect(isValidUsername('ab')).toBe(false); // 太短
      expect(isValidUsername('abc')).toBe(false); // 太短
      expect(isValidUsername('thisusernameistoolong123')).toBe(false); // 太长
      expect(isValidUsername('user@name')).toBe(false); // 包含特殊字符
      expect(isValidUsername('user name')).toBe(false); // 包含空格
    });
  });

  describe('isValidAmount', () => {
    it('应该验证有效金额', () => {
      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount(100.50)).toBe(true);
      expect(isValidAmount('100')).toBe(true);
      expect(isValidAmount('100.50')).toBe(true);
      expect(isValidAmount('0')).toBe(true);
      expect(isValidAmount('0.99')).toBe(true);
    });

    it('应该拒绝无效金额', () => {
      expect(isValidAmount(-100)).toBe(false); // 负数
      expect(isValidAmount('abc')).toBe(false); // 非数字
      expect(isValidAmount('100.999')).toBe(false); // 超过两位小数
      expect(isValidAmount(NaN)).toBe(false); // NaN
      expect(isValidAmount('')).toBe(false); // 空字符串
    });
  });

  describe('isValidPhoneNumber', () => {
    it('应该验证有效的手机号', () => {
      expect(isValidPhoneNumber('13800138000')).toBe(true);
      expect(isValidPhoneNumber('15012345678')).toBe(true);
      expect(isValidPhoneNumber('18888888888')).toBe(true);
      expect(isValidPhoneNumber('19999999999')).toBe(true);
    });

    it('应该拒绝无效的手机号', () => {
      expect(isValidPhoneNumber('12800138000')).toBe(false); // 12开头
      expect(isValidPhoneNumber('10800138000')).toBe(false); // 10开头
      expect(isValidPhoneNumber('1380013800')).toBe(false); // 位数不够
      expect(isValidPhoneNumber('138001380000')).toBe(false); // 位数太多
      expect(isValidPhoneNumber('abc')).toBe(false);
      expect(isValidPhoneNumber('')).toBe(false);
    });
  });

  describe('isValidIdCard', () => {
    it('应该验证有效的身份证号', () => {
      expect(isValidIdCard('11010519900307234X')).toBe(true);
      expect(isValidIdCard('110105199003072345')).toBe(true);
      expect(isValidIdCard('440308199901011234')).toBe(true);
    });

    it('应该拒绝无效的身份证号', () => {
      expect(isValidIdCard('123456789012345678')).toBe(false); // 错误格式
      expect(isValidIdCard('110105189003072345')).toBe(false); // 18开头
      expect(isValidIdCard('110105199013072345')).toBe(false); // 13月
      expect(isValidIdCard('110105199003322345')).toBe(false); // 32日
      expect(isValidIdCard('')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('应该验证有效的URL', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://www.example.com')).toBe(true);
      expect(isValidUrl('https://api.example.com/v1/users')).toBe(true);
      expect(isValidUrl('ftp://files.example.com')).toBe(true);
    });

    it('应该拒绝无效的URL', () => {
      expect(isValidUrl('www.example.com')).toBe(false); // 缺少协议
      expect(isValidUrl('example')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isValidDate', () => {
    it('应该验证有效的日期', () => {
      expect(isValidDate('2025-01-15')).toBe(true);
      expect(isValidDate('1999-12-31')).toBe(true);
      expect(isValidDate('2000-02-29')).toBe(true); // 闰年
    });

    it('应该拒绝无效的日期', () => {
      expect(isValidDate('2025-13-01')).toBe(false); // 无效月份
      expect(isValidDate('2025-02-30')).toBe(false); // 无效日期
      expect(isValidDate('2025-1-1')).toBe(false); // 格式错误
      expect(isValidDate('25-01-15')).toBe(false); // 格式错误
      expect(isValidDate('')).toBe(false);
    });
  });

  describe('isValidSKU', () => {
    it('应该验证有效的SKU', () => {
      expect(isValidSKU('AB123')).toBe(true);
      expect(isValidSKU('ABC12345')).toBe(true);
      expect(isValidSKU('XYZ999999')).toBe(true);
    });

    it('应该拒绝无效的SKU', () => {
      expect(isValidSKU('A123')).toBe(false); // 字母太少
      expect(isValidSKU('ABCD123')).toBe(false); // 字母太多
      expect(isValidSKU('AB12')).toBe(false); // 数字太少
      expect(isValidSKU('AB123456789')).toBe(false); // 数字太多
      expect(isValidSKU('ab123')).toBe(false); // 小写字母
      expect(isValidSKU('AB-123')).toBe(false); // 包含特殊字符
    });
  });

  describe('isValidOrderNo', () => {
    it('应该验证有效的订单号', () => {
      expect(isValidOrderNo('ZD20250115123456789')).toBe(true);
    });

    it('应该拒绝无效的订单号', () => {
      expect(isValidOrderNo('ZD2025011512345678')).toBe(false); // 位数不够
      expect(isValidOrderNo('ZD202501151234567890')).toBe(false); // 位数太多
      expect(isValidOrderNo('AB20250115123456789')).toBe(false); // 错误前缀
      expect(isValidOrderNo('')).toBe(false);
    });
  });
});

// 业务规则验证
describe('业务规则验证', () => {
  // 用户等级验证
  const isValidUserLevel = (level: string): boolean => {
    const validLevels = ['NORMAL', 'VIP', 'STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'];
    return validLevels.includes(level);
  };

  // 订单状态验证
  const isValidOrderStatus = (status: string): boolean => {
    const validStatuses = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    return validStatuses.includes(status);
  };

  // 支付方式验证
  const isValidPaymentMethod = (method: string): boolean => {
    const validMethods = ['WECHAT', 'ALIPAY', 'POINTS', 'BANK_TRANSFER'];
    return validMethods.includes(method);
  };

  // 商品状态验证
  const isValidProductStatus = (status: string): boolean => {
    const validStatuses = ['ACTIVE', 'INACTIVE', 'DRAFT', 'OUT_OF_STOCK'];
    return validStatuses.includes(status);
  };

  describe('isValidUserLevel', () => {
    it('应该验证有效的用户等级', () => {
      expect(isValidUserLevel('NORMAL')).toBe(true);
      expect(isValidUserLevel('VIP')).toBe(true);
      expect(isValidUserLevel('STAR_5')).toBe(true);
      expect(isValidUserLevel('DIRECTOR')).toBe(true);
    });

    it('应该拒绝无效的用户等级', () => {
      expect(isValidUserLevel('VIP2')).toBe(false);
      expect(isValidUserLevel('STAR')).toBe(false);
      expect(isValidUserLevel('INVALID')).toBe(false);
      expect(isValidUserLevel('')).toBe(false);
    });
  });

  describe('isValidOrderStatus', () => {
    it('应该验证有效的订单状态', () => {
      expect(isValidOrderStatus('PENDING')).toBe(true);
      expect(isValidOrderStatus('DELIVERED')).toBe(true);
      expect(isValidOrderStatus('CANCELLED')).toBe(true);
    });

    it('应该拒绝无效的订单状态', () => {
      expect(isValidOrderStatus('PROCESSING')).toBe(false);
      expect(isValidOrderStatus('invalid')).toBe(false);
      expect(isValidOrderStatus('')).toBe(false);
    });
  });

  describe('isValidPaymentMethod', () => {
    it('应该验证有效的支付方式', () => {
      expect(isValidPaymentMethod('WECHAT')).toBe(true);
      expect(isValidPaymentMethod('ALIPAY')).toBe(true);
      expect(isValidPaymentMethod('POINTS')).toBe(true);
    });

    it('应该拒绝无效的支付方式', () => {
      expect(isValidPaymentMethod('CASH')).toBe(false);
      expect(isValidPaymentMethod('CREDIT_CARD')).toBe(false);
      expect(isValidPaymentMethod('')).toBe(false);
    });
  });
});