/**
 * Prisma类型统一导出
 * 避免在每个文件中重复导入相同的类型
 */

import { PrismaClient as PrismaClientType } from '@prisma/client';

// 重新导出所有Prisma类型
export * from '@prisma/client';

// 常用类型组合
export type PrismaTransaction = Omit<PrismaClientType, '$connect' | '$disconnect' | '$queryRaw' | '$executeRaw'>;