#!/usr/bin/env tsx

/**
 * 从后端Prisma Schema生成前端TypeScript类型定义
 * 确保前后端类型定义的一致性
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// 需要为前端生成类型的模型
const FRONTEND_MODELS = [
  'User',
  'Product',
  'ProductCategory',
  'ProductSpecification',
  'Shop',
  'Order',
  'OrderItem',
  'PointsTransaction',
  'InventoryItem',
  'Stock',
  'Team',
  'CommissionCalculation'
];

// API响应格式
const API_RESPONSE_TYPES = `
// API通用响应格式
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

// 分页请求参数
export interface PaginationParams {
  page?: number;
  perPage?: number;
}

// 排序参数
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 通用查询参数
export interface QueryParams extends PaginationParams, SortParams {
  search?: string;
  filters?: Record<string, any>;
}
`;

/**
 * 生成单个模型的类型定义
 */
function generateModelType(modelName: string): string {
  const modelFields = prisma[modelName.toLowerCase() as keyof PrismaClient].fields;

  let typeDef = `export interface ${modelName} {\n`;

  // 获取字段信息
  for (const [fieldName, field] of Object.entries(modelFields)) {
    const optional = field.optional ? '?' : '';
    const type = getFieldType(field);

    typeDef += `  ${fieldName}${optional}: ${type};\n`;
  }

  typeDef += `}\n\n`;

  // 生成创建和更新类型
  typeDef += generateCreateUpdateTypes(modelName, modelFields);

  return typeDef;
}

/**
 * 获取字段的TypeScript类型
 */
function getFieldType(field: any): string {
  if (field.kind === 'scalar') {
    switch (field.type) {
      case 'String': return 'string';
      case 'Int': return 'number';
      case 'Float': return 'number';
      case 'Boolean': return 'boolean';
      case 'DateTime': return 'Date | string';
      case 'Json': return 'any';
      case 'BigInt': return 'number';
      case 'Bytes': return 'Buffer';
      case 'Decimal': return 'number';
      default: return 'any';
    }
  } else if (field.kind === 'object') {
    // 处理关联关系
    return `any`; // 可以进一步优化为具体的关联类型
  } else if (field.kind === 'enum') {
    return field.type;
  }

  return 'any';
}

/**
 * 生成创建和更新类型
 */
function generateCreateUpdateTypes(modelName: string, fields: any): string {
  let createFields: string[] = [];
  let updateFields: string[] = [];

  for (const [fieldName, field] of Object.entries(fields)) {
    // 跳过自动生成的字段
    if (field.name === 'id' || field.name === 'createdAt' || field.name === 'updatedAt') {
      if (!field.optional) {
        continue;
      }
    }

    const optional = !field.optional ? '?' : '';
    const type = getFieldType(field);

    createFields.push(`${fieldName}${optional}: ${type}`);

    // 更新类型所有字段都是可选的
    updateFields.push(`${fieldName}?: ${type}`);
  }

  let result = '';

  if (createFields.length > 0) {
    result += `export interface Create${modelName}Input {\n`;
    result += createFields.map(f => `  ${f};`).join('\n');
    result += `\n}\n\n`;
  }

  if (updateFields.length > 0) {
    result += `export interface Update${modelName}Input {\n`;
    result += updateFields.map(f => `  ${f};`).join('\n');
    result += `\n}\n\n`;
  }

  return result;
}

/**
 * 生成API相关的类型定义
 */
function generateApiTypes(): string {
  return `
// 用户认证相关类型
export interface LoginRequest {
  code?: string; // 微信登录code
  phone?: string;
  verificationCode?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

// 商品相关类型
export interface ProductListResponse {
  products: Product[];
  categories: ProductCategory[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// 订单相关类型
export interface CreateOrderRequest {
  items: Array<{
    productId: string;
    quantity: number;
    specifications?: Record<string, any>;
  }>;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
  };
  remark?: string;
}

// 积分相关类型
export interface TransferPointsRequest {
  toUserId: string;
  amount: number;
  remark?: string;
}

// 团队相关类型
export interface TeamStats {
  totalMembers: number;
  directMembers: number;
  indirectMembers: number;
  levelDistribution: Record<string, number>;
  performance: {
    totalOrders: number;
    totalAmount: number;
    monthAmount: number;
  };
}

// 文件上传类型
export interface UploadResponse {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}
`;
}

/**
 * 主函数
 */
async function generateTypes() {
  try {
    console.log('🔄 正在从后端生成前端类型定义...');

    let output = `// 自动生成的类型定义 - 请勿手动修改
// Generated at: ${new Date().toISOString()}
// Source: Prisma Schema

${API_RESPONSE_TYPES}

`;

    // 生成模型类型
    for (const model of FRONTEND_MODELS) {
      console.log(`📝 生成模型: ${model}`);
      output += generateModelType(model);
    }

    // 生成API类型
    console.log('📝 生成API类型');
    output += generateApiTypes();

    // 确保输出目录存在
    const outputDir = path.join(__dirname, '../../D:/wwwroot/zhongdao-h5/src/types');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 写入文件
    const outputFile = path.join(outputDir, 'api.types.ts');
    fs.writeFileSync(outputFile, output, 'utf-8');

    console.log('✅ 类型定义生成完成:', outputFile);

    // 生成索引文件
    const indexFile = path.join(outputDir, 'index.ts');
    const indexContent = `// 导出所有类型定义
export * from './api.types';
export * from './auth.types';
export * from './common.types';
`;

    fs.writeFileSync(indexFile, indexContent, 'utf-8');

    console.log('✅ 索引文件更新完成:', indexFile);

  } catch (error) {
    console.error('❌ 生成类型定义失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  generateTypes();
}

export { generateTypes };