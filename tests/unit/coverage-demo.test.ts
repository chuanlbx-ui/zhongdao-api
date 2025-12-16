/**
 * 覆盖率演示测试
 * 用于生成覆盖率报告的简单测试
 */

import { describe, it, expect } from 'vitest';

// 被测试的函数
const add = (a: number, b: number): number => a + b;
const multiply = (a: number, b: number): number => a * b;
const divide = (a: number, b: number): number => {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
};

// 复杂的业务逻辑
class ShoppingCart {
  private items: Array<{ name: string; price: number; quantity: number }> = [];

  addItem(name: string, price: number, quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    if (price < 0) {
      throw new Error('Price cannot be negative');
    }
    this.items.push({ name, price, quantity });
  }

  removeItem(name: string): boolean {
    const index = this.items.findIndex(item => item.name === name);
    if (index > -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  getTotal(): number {
    return this.items.reduce((total, item) => total + item.price * item.quantity, 0);
  }

  getItemCount(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  getItems(): Array<{ name: string; price: number; quantity: number }> {
    return [...this.items];
  }
}

// 用户管理类
class UserManager {
  private users: Map<string, { name: string; age: number; email: string }> = new Map();

  addUser(id: string, name: string, age: number, email: string): boolean {
    if (this.users.has(id)) {
      return false;
    }
    this.users.set(id, { name, age, email });
    return true;
  }

  removeUser(id: string): boolean {
    return this.users.delete(id);
  }

  getUser(id: string): { name: string; age: number; email } | undefined {
    return this.users.get(id);
  }

  getAllUsers(): Array<{ id: string; name: string; age: number; email: string }> {
    return Array.from(this.users.entries()).map(([id, user]) => ({ id, ...user }));
  }

  updateUserAge(id: string, age: number): boolean {
    const user = this.users.get(id);
    if (!user) return false;
    if (age < 0 || age > 150) return false;
    user.age = age;
    return true;
  }
}

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
  });

  it('商品价格不能为负数', () => {
    expect(() => cart.addItem('Invalid', -1.00, 1)).toThrow('Price cannot be negative');
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

  it('年龄必须在有效范围内', () => {
    userManager.addUser('9', 'Jack', 30, 'jack@example.com');
    expect(userManager.updateUserAge('9', -1)).toBe(false);
    expect(userManager.updateUserAge('9', 200)).toBe(false);
  });
});

// 导出类和函数以确保它们被包含在覆盖率中
export { add, multiply, divide, ShoppingCart, UserManager };