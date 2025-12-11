/**
 * 文件上传配置
 * 统一管理文件上传相关的配置参数
 */

import path from 'path';

export const FILE_CONFIG = {
  // 最大文件大小（统一为10MB）
  maxSize: 10 * 1024 * 1024, // 10MB

  // 允许的文件类型
  allowedTypes: {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    video: ['video/mp4', 'video/mpeg', 'video/quicktime'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg']
  },

  // 上传目录配置
  uploadDirs: {
    avatar: './uploads/avatars',
    product: './uploads/products',
    document: './uploads/documents',
    general: './uploads/general'
  },

  // 文件名配置
  maxFileNameLength: 255,

  // 安全配置
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'],

  // 扫描配置
  scanConfig: {
    enableVirusScan: process.env.NODE_ENV === 'production',
    maxScanSize: 50 * 1024 * 1024, // 50MB
    scanTimeout: 30000 // 30秒
  }
};

/**
 * 获取上传配置
 */
export function getUploadConfig(type: keyof typeof FILE_CONFIG.uploadDirs = 'general') {
  return {
    ...FILE_CONFIG,
    uploadDir: FILE_CONFIG.uploadDirs[type],
    maxSize: FILE_CONFIG.maxSize,
    allowedTypes: Object.values(FILE_CONFIG.allowedTypes).flat(),
    maxFileNameLength: FILE_CONFIG.maxFileNameLength
  };
}

/**
 * 文件类型验证
 */
export function isFileTypeAllowed(mimeType: string, type?: keyof typeof FILE_CONFIG.allowedTypes): boolean {
  if (type && FILE_CONFIG.allowedTypes[type]) {
    return FILE_CONFIG.allowedTypes[type].includes(mimeType);
  }

  return Object.values(FILE_CONFIG.allowedTypes).flat().includes(mimeType);
}

/**
 * 文件扩展名验证
 */
export function isExtensionSafe(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return FILE_CONFIG.allowedExtensions.includes(ext);
}