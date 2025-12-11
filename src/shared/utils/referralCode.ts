import { prisma } from '../database/client';
import logger from "@/shared/utils/logger";

/**
 * 生成6位数字字母组合随机推荐码
 * 使用数字(0-9)和大写字母(A-Z)，排除容易混淆的字符
 * @returns 6位字符串推荐码
 */
export function generateReferralCode(): string {
  // 排除容易混淆的字符：0(零), O(字母O), 1(一), I(字母I), l(小写L)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 30个字符
  let code = '';

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
}

/**
 * 生成唯一的推荐码（检查数据库避免重复）
 * @param maxRetries 最大重试次数，默认100次
 * @returns 唯一的6位数字字母组合推荐码
 */
export async function generateUniqueReferralCode(maxRetries: number = 100): Promise<string> {
  let attempts = 0;

  while (attempts < maxRetries) {
    const code = generateReferralCode();

    // 检查推荐码是否已存在
    const existingUser = await prisma.users.findUnique({
      where: { referralCode: code },
      select: { id: true }
    });

    if (!existingUser) {
      return code;
    }

    attempts++;
  }

  throw new Error(`无法生成唯一推荐码，已尝试${maxRetries}次`);
}

/**
 * 通过推荐码查找用户
 * @param referralCode 推荐码
 * @returns 用户信息或null
 */
export async function findUserByReferralCode(referralCode: string) {
  if (!referralCode || referralCode.length !== 6) {
    return null;
  }

  return await prisma.users.findUnique({
    where: { referralCode: referralCode },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      level: true,
      status: true
    }
  });
}

/**
 * 验证推荐码是否有效
 * @param referralCode 推荐码
 * @returns 验证结果
 */
export async function validateReferralCode(referralCode: string) {
  if (!referralCode || referralCode.length !== 6) {
    return {
      valid: false,
      error: '推荐码必须是6位数字字母组合'
    };
  }

  // 验证推荐码格式：6位，只包含数字和大写字母，排除易混淆字符
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(referralCode)) {
    return {
      valid: false,
      error: '推荐码格式错误，应为6位数字字母组合'
    };
  }

  const referrer = await findUserByReferralCode(referralCode);

  if (!referrer) {
    return {
      valid: false,
      error: '推荐码不存在或已失效'
    };
  }

  if (referrer.status !== 'ACTIVE') {
    return {
      valid: false,
      error: '推荐人账号异常，无法使用该推荐码'
    };
  }

  return {
    valid: true,
    referrer
  };
}