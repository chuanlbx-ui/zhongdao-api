/**
 * 覆盖率演示测试 - 测试源文件
 * 用于生成覆盖率报告的测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  add,
  multiply,
  divide,
  subtract,
  formatCurrency,
  capitalize,
  unique,
  chunk,
  isEmail,
  isPhoneNumber,
  ShoppingCart,
  UserManager,
  debounce,
  throttle
} from '../../src/utils/coverage-demo';

describe('数学运算测试', () => {
  it('应该正确执行加法', () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
    expect(add(0, 0)).toBe(0);
  });

  it('应该正确执行乘法', () => {
    expect(multiply(2, 3)).toBe(6);
    expect(multiply(-1, 5)).toBe(-5);
    expect(multiply(0, 100)).toBe(0);
  });

  it('应该正确执行除法', () => {
    expect(divide(6, 2)).toBe(3);
    expect(divide(10, 5)).toBe(2);
    expect(divide(-4, 2)).toBe(-2);
  });

  it('除以零应该抛出错误', () => {
    expect(() => divide(5, 0)).toThrow('Division by zero');
  });

  it('应该正确执行减法', () => {
    expect(subtract(5, 3)).toBe(2);
    expect(subtract(0, 5)).toBe(-5);
    expect(subtract(-3, -3)).toBe(0);
  });
});

describe('字符串处理测试', () => {
  it('应该正确格式化货币', () => {
    expect(formatCurrency(100)).toBe('¥100.00');
    expect(formatCurrency(1234.56)).toBe('¥1,234.56');
    expect(formatCurrency(0, 'USD')).toBe('US$0.00');
  });

  it('应该正确转换大小写', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('WORLD')).toBe('World');
    expect(capitalize('')).toBe('');
    expect(capitalize('a')).toBe('A');
  });
});

describe('数组处理测试', () => {
  it('应该去重', () => {
    expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
    expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('应该分块', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it('分块大小必须为正数', () => {
    expect(() => chunk([1, 2, 3], 0)).toThrow('Size must be positive');
    expect(() => chunk([1, 2, 3], -1)).toThrow('Size must be positive');
  });
});

describe('验证函数测试', () => {
  it('应该验证邮箱', () => {
    expect(isEmail('test@example.com')).toBe(true);
    expect(isEmail('user.name+tag@domain.co.uk')).toBe(true);
    expect(isEmail('invalid-email')).toBe(false);
    expect(isEmail('@domain.com')).toBe(false);
    expect(isEmail('user@')).toBe(false);
  });

  it('应该验证手机号', () => {
    expect(isPhoneNumber('13812345678')).toBe(true);
    expect(isPhoneNumber('15900000000')).toBe(true);
    expect(isPhoneNumber('12812345678')).toBe(false);
    expect(isPhoneNumber('1381234567')).toBe(false);
    expect(isPhoneNumber('abc12345678')).toBe(false);
  });
});

describe('购物车测试', () => {
  let cart: ShoppingCart;

  beforeEach(() => {
    cart = new ShoppingCart();
  });

  it('应该能够添加商品', () => {
    cart.addItem('Apple', 1.99, 5);
    cart.addItem('Banana', 0.99, 3);
    expect(cart.getItemCount()).toBe(2);
  });

  it('应该能够计算总价', () => {
    cart.addItem('Apple', 2.00, 3);
    cart.addItem('Orange', 1.50, 2);
    expect(cart.getTotal()).toBe(9.00); // 2*3 + 1.5*2
  });

  it('应该能够移除商品', () => {
    cart.addItem('Grapes', 5.00, 2);
    expect(cart.removeItem('Grapes')).toBe(true);
    expect(cart.removeItem('NonExistent')).toBe(false);
    expect(cart.getItemCount()).toBe(0);
  });

  it('应该能够清空购物车', () => {
    cart.addItem('Milk', 3.99, 1);
    cart.addItem('Bread', 2.50, 2);
    cart.clear();
    expect(cart.getItemCount()).toBe(0);
    expect(cart.getTotal()).toBe(0);
  });

  it('添加商品数量应该为正数', () => {
    expect(() => cart.addItem('Invalid', 1.00, -1)).toThrow('Quantity must be positive');
    expect(() => cart.addItem('Invalid', 1.00, 0)).toThrow('Quantity must be positive');
  });

  it('商品价格不能为负数', () => {
    expect(() => cart.addItem('Invalid', -1.00, 1)).toThrow('Price cannot be negative');
  });

  it('getItems应该返回副本', () => {
    cart.addItem('Test', 1.00, 1);
    const items = cart.getItems();
    items.push({ name: 'Extra', price: 2.00, quantity: 1 });
    expect(cart.getItemCount()).toBe(1);
  });
});

describe('用户管理测试', () => {
  let userManager: UserManager;

  beforeEach(() => {
    userManager = new UserManager();
  });

  it('应该能够添加用户', () => {
    expect(userManager.addUser('1', 'Alice', 25, 'alice@example.com')).toBe(true);
    expect(userManager.addUser('2', 'Bob', 30, 'bob@example.com')).toBe(true);
  });

  it('不应该添加重复ID的用户', () => {
    userManager.addUser('3', 'Charlie', 35, 'charlie@example.com');
    expect(userManager.addUser('3', 'David', 40, 'david@example.com')).toBe(false);
  });

  it('应该能够获取用户', () => {
    userManager.addUser('4', 'Eve', 28, 'eve@example.com');
    const user = userManager.getUser('4');
    expect(user).toEqual({
      name: 'Eve',
      age: 28,
      email: 'eve@example.com'
    });
  });

  it('应该能够移除用户', () => {
    userManager.addUser('5', 'Frank', 32, 'frank@example.com');
    expect(userManager.removeUser('5')).toBe(true);
    expect(userManager.removeUser('5')).toBe(false);
    expect(userManager.getUser('5')).toBeUndefined();
  });

  it('应该获取所有用户', () => {
    userManager.addUser('6', 'Grace', 27, 'grace@example.com');
    userManager.addUser('7', 'Henry', 31, 'henry@example.com');
    const users = userManager.getAllUsers();
    expect(users.length).toBeGreaterThanOrEqual(2);
    expect(users[0]).toHaveProperty('id');
    expect(users[0]).toHaveProperty('name');
    expect(users[0]).toHaveProperty('age');
    expect(users[0]).toHaveProperty('email');
  });

  it('应该能够更新用户年龄', () => {
    userManager.addUser('8', 'Ivy', 26, 'ivy@example.com');
    expect(userManager.updateUserAge('8', 27)).toBe(true);
    expect(userManager.getUser('8')?.age).toBe(27);
  });

  it('应该能够更新用户邮箱', () => {
    userManager.addUser('9', 'Jack', 30, 'jack@example.com');
    expect(userManager.updateUserEmail('9', 'jack.new@example.com')).toBe(true);
    expect(userManager.getUser('9')?.email).toBe('jack.new@example.com');
  });

  it('年龄必须在有效范围内', () => {
    userManager.addUser('10', 'Kate', 30, 'kate@example.com');
    expect(userManager.updateUserAge('10', -1)).toBe(false);
    expect(userManager.updateUserAge('10', 200)).toBe(false);
  });

  it('邮箱必须有效', () => {
    userManager.addUser('11', 'Leo', 25, 'leo@example.com');
    expect(userManager.updateUserEmail('11', 'invalid-email')).toBe(false);
  });

  it('应该能够搜索用户', () => {
    userManager.addUser('12', 'Mike Smith', 35, 'mike.smith@example.com');
    userManager.addUser('13', 'Sarah Johnson', 28, 'sarah.j@example.com');
    userManager.addUser('14', 'Tom Wilson', 40, 'tom@example.com');

    const results1 = userManager.searchUsers('mike');
    expect(results1).toHaveLength(1);
    expect(results1[0].name).toBe('Mike Smith');

    const results2 = userManager.searchUsers('example.com');
    expect(results2.length).toBeGreaterThanOrEqual(2);

    const results3 = userManager.searchUsers('nonexistent');
    expect(results3).toHaveLength(0);
  });
});

describe('工具函数测试', () => {
  it('debounce应该延迟执行', (done) => {
    let count = 0;
    const debouncedFn = debounce(() => count++, 100);

    debouncedFn();
    expect(count).toBe(0);

    setTimeout(() => {
      expect(count).toBe(1);
      done();
    }, 150);
  });

  it('throttle应该限制执行频率', () => {
    let count = 0;
    const throttledFn = throttle(() => count++, 100);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(count).toBe(1);
  });
});