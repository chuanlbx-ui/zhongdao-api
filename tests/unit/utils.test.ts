/**
 * 工具函数单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';

// 测试工具函数示例
describe('工具函数测试', () => {

  // 示例：格式化金额函数
  const formatAmount = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0.00';
    return num.toFixed(2);
  };

  // 示例：验证手机号函数
  const isValidPhone = (phone: string): boolean => {
    return /^1[3-9]\d{9}$/.test(phone);
  };

  // 示例：生成订单号函数
  const generateOrderNo = (): string => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ZD${timestamp}${random}`;
  };

  // 示例：计算折扣价格函数
  const calculateDiscountPrice = (originalPrice: number, discountPercent: number): number => {
    if (discountPercent < 0 || discountPercent > 100) {
      throw new Error('折扣百分比必须在0-100之间');
    }
    return Math.round(originalPrice * (100 - discountPercent) / 100 * 100) / 100;
  };

  describe('formatAmount', () => {
    it('应该正确格式化数字金额', () => {
      expect(formatAmount(100)).toBe('100.00');
      expect(formatAmount(100.5)).toBe('100.50');
      expect(formatAmount(100.555)).toBe('100.56');
    });

    it('应该正确格式化字符串金额', () => {
      expect(formatAmount('100')).toBe('100.00');
      expect(formatAmount('100.5')).toBe('100.50');
    });

    it('应该处理无效输入', () => {
      expect(formatAmount('')).toBe('0.00');
      expect(formatAmount('abc')).toBe('0.00');
      expect(formatAmount(NaN)).toBe('0.00');
    });
  });

  describe('isValidPhone', () => {
    it('应该验证有效的手机号', () => {
      expect(isValidPhone('13800138000')).toBe(true);
      expect(isValidPhone('15012345678')).toBe(true);
      expect(isValidPhone('18888888888')).toBe(true);
    });

    it('应该拒绝无效的手机号', () => {
      expect(isValidPhone('12800138000')).toBe(false); // 12开头
      expect(isValidPhone('1380013800')).toBe(false);  // 位数不够
      expect(isValidPhone('138001380000')).toBe(false); // 位数太多
      expect(isValidPhone('abc')).toBe(false);
      expect(isValidPhone('')).toBe(false);
    });
  });

  describe('generateOrderNo', () => {
    it('应该生成正确格式的订单号', () => {
      const orderNo = generateOrderNo();
      expect(orderNo).toMatch(/^ZD\d{16}$/);
      expect(orderNo).toHaveLength(18);
    });

    it('应该生成唯一的订单号', () => {
      const orderNos = new Set();
      for (let i = 0; i < 100; i++) {
        orderNos.add(generateOrderNo());
      }
      expect(orderNos.size).toBeGreaterThanOrEqual(90);
    });
  });

  describe('calculateDiscountPrice', () => {
    it('应该正确计算折扣价格', () => {
      expect(calculateDiscountPrice(100, 10)).toBe(90);
      expect(calculateDiscountPrice(99.99, 50)).toBe(50);
      expect(calculateDiscountPrice(100, 0)).toBe(100);
      expect(calculateDiscountPrice(100, 100)).toBe(0);
    });

    it('应该处理小数精度', () => {
      expect(calculateDiscountPrice(100, 33)).toBe(67);
      expect(calculateDiscountPrice(99.99, 33)).toBe(66.99);
    });

    it('应该拒绝无效的折扣百分比', () => {
      expect(() => calculateDiscountPrice(100, -1)).toThrow('折扣百分比必须在0-100之间');
      expect(() => calculateDiscountPrice(100, 101)).toThrow('折扣百分比必须在0-100之间');
    });
  });
});

// 更多工具函数测试
describe('字符串处理工具', () => {
  const truncateText = (text: string, maxLength: number, suffix = '...'): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  };

  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  describe('truncateText', () => {
    it('应该截断长文本', () => {
      expect(truncateText('Hello World', 8)).toBe('Hello...');
      expect(truncateText('Hello World', 12)).toBe('Hello World...');
    });

    it('应该保留短文本不变', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
      expect(truncateText('', 5)).toBe('');
    });

    it('应该使用自定义后缀', () => {
      expect(truncateText('Hello World', 8, '---')).toBe('Hello---');
    });
  });

  describe('generateSlug', () => {
    it('应该生成正确的slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
      expect(generateSlug('Hello, World!')).toBe('hello-world');
      expect(generateSlug('  Hello   World  ')).toBe('hello-world');
    });

    it('应该处理特殊字符', () => {
      expect(generateSlug('产品名称测试')).toBe('');
      expect(generateSlug('Test-123_ABC')).toBe('test-123-abc');
    });

    it('应该处理空字符串', () => {
      expect(generateSlug('')).toBe('');
      expect(generateSlug('---')).toBe('');
    });
  });
});

// 日期处理工具测试
describe('日期处理工具', () => {
  const formatDate = (date: Date, format = 'YYYY-MM-DD'): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('ss', second);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  describe('formatDate', () => {
    const testDate = new Date(2025, 0, 15, 14, 30, 45); // 2025-01-15 14:30:45

    it('应该格式化日期', () => {
      expect(formatDate(testDate)).toBe('2025-01-15');
      expect(formatDate(testDate, 'YYYY/MM/DD')).toBe('2025/01/15');
      expect(formatDate(testDate, 'DD-MM-YYYY')).toBe('15-01-2025');
    });

    it('应该格式化日期时间', () => {
      expect(formatDate(testDate, 'YYYY-MM-DD HH:mm:ss')).toBe('2025-01-15 14:30:45');
    });
  });

  describe('isToday', () => {
    it('应该识别今天的日期', () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);
    });

    it('应该识别不是今天的日期', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isTomorrow(tomorrow)).toBe(false);
    });
  });

  describe('addDays', () => {
    it('应该正确添加天数', () => {
      const date = new Date(2025, 0, 15); // 2025-01-15
      const newDate = addDays(date, 5);
      expect(newDate.getDate()).toBe(20);
    });

    it('应该正确减去天数', () => {
      const date = new Date(2025, 0, 15); // 2025-01-15
      const newDate = addDays(date, -5);
      expect(newDate.getDate()).toBe(10);
    });

    it('应该处理月份边界', () => {
      const date = new Date(2025, 0, 31); // 2025-01-31
      const newDate = addDays(date, 1);
      expect(newDate.getMonth()).toBe(1); // 2月
      expect(newDate.getDate()).toBe(1);
    });
  });
});

// 数组处理工具测试
describe('数组处理工具', () => {
  const chunk = <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  const unique = <T>(array: T[]): T[] => {
    return Array.from(new Set(array));
  };

  const groupBy = <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  };

  describe('chunk', () => {
    it('应该分割数组', () => {
      const array = [1, 2, 3, 4, 5, 6, 7];
      expect(chunk(array, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
      expect(chunk(array, 2)).toEqual([[1, 2], [3, 4], [5, 6], [7]]);
    });

    it('应该处理空数组', () => {
      expect(chunk([], 3)).toEqual([]);
    });

    it('应该处理大小大于数组长度的情况', () => {
      const array = [1, 2, 3];
      expect(chunk(array, 10)).toEqual([[1, 2, 3]]);
    });
  });

  describe('unique', () => {
    it('应该去重', () => {
      expect(unique([1, 2, 2, 3, 1, 4])).toEqual([1, 2, 3, 4]);
      expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('应该处理空数组', () => {
      expect(unique([])).toEqual([]);
    });

    it('应该保留顺序', () => {
      expect(unique([3, 1, 2, 3, 1])).toEqual([3, 1, 2]);
    });
  });

  describe('groupBy', () => {
    interface Item {
      id: number;
      category: string;
    }

    it('应该按指定键分组', () => {
      const items: Item[] = [
        { id: 1, category: 'A' },
        { id: 2, category: 'B' },
        { id: 3, category: 'A' },
        { id: 4, category: 'C' },
        { id: 5, category: 'B' }
      ];

      const grouped = groupBy(items, 'category');
      expect(grouped).toEqual({
        'A': [{ id: 1, category: 'A' }, { id: 3, category: 'A' }],
        'B': [{ id: 2, category: 'B' }, { id: 5, category: 'B' }],
        'C': [{ id: 4, category: 'C' }]
      });
    });

    it('应该处理空数组', () => {
      expect(groupBy([], 'category')).toEqual({});
    });
  });
});