/**
 * 覆盖率演示源文件
 * 用于生成测试覆盖率报告的实际源代码
 */

// 简单的数学运算函数
export const add = (a: number, b: number): number => a + b;

export const multiply = (a: number, b: number): number => a * b;

export const divide = (a: number, b: number): number => {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
};

export const subtract = (a: number, b: number): number => a - b;

// 字符串处理函数
export const formatCurrency = (amount: number, currency: string = 'CNY'): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const capitalize = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// 数组处理函数
export const unique = <T>(arr: T[]): T[] => {
  return Array.from(new Set(arr));
};

export const chunk = <T>(arr: T[], size: number): T[][] => {
  if (size <= 0) throw new Error('Size must be positive');
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

// 验证函数
export const isEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
};

// 业务逻辑类
export class ShoppingCart {
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
export class UserManager {
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

  updateUserEmail(id: string, email: string): boolean {
    const user = this.users.get(id);
    if (!user) return false;
    if (!isEmail(email)) return false;
    user.email = email;
    return true;
  }

  searchUsers(query: string): Array<{ id: string; name: string; age: number; email: string }> {
    const lowerQuery = query.toLowerCase();
    return this.getAllUsers().filter(user =>
      user.name.toLowerCase().includes(lowerQuery) ||
      user.email.toLowerCase().includes(lowerQuery)
    );
  }
}

// 工具函数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};