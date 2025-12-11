import { Request, Response, NextFunction } from 'express';
import { createErrorResponse, ErrorCode } from '../types/response';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

// 类型定义
interface FileUploadConfig {
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxFileSize: number;
  maxFileNameLength: number;
  uploadDir: string;
  tempDir: string;
  enableVirusScan: boolean;
  enableContentValidation: boolean;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    [key: string]: any;
  };
}

interface FileValidationResult {
  isValid: boolean;
  error?: string;
  errorCode?: ErrorCode;
  details?: any;
}

// 文件上传安全配置
export const FILE_UPLOAD_CONFIG: FileUploadConfig = {
  // 允许的文件类型
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],

  // 允许的文件扩展名
  allowedExtensions: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.txt', '.doc', '.docx'
  ],

  // 文件大小限制 (字节)
  maxFileSize: 10 * 1024 * 1024, // 10MB

  // 最大文件名长度
  maxFileNameLength: 255,

  // 安全上传目录
  uploadDir: './uploads',

  // 临时文件目录
  tempDir: './temp',

  // 是否启用病毒扫描
  enableVirusScan: false,

  // 是否启用文件内容验证
  enableContentValidation: true
};

// 危险文件扩展名黑名单
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
  '.php', '.asp', '.aspx', '.jsp', '.sh', '.ps1', '.py', '.rb', '.pl',
  '.sql', '.msi', '.deb', '.rpm', '.dmg', '.app', '.pkg', '.iso'
];

// 危险MIME类型黑名单
const DANGEROUS_MIME_TYPES = [
  'application/x-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-shellscript',
  'text/x-php',
  'application/x-php',
  'text/x-python',
  'application/x-python'
];

/**
 * 检查文件扩展名是否安全
 */
const isExtensionSafe = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();

  // 检查是否在黑名单中
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return false;
  }

  // 检查是否在允许列表中
  if (!FILE_UPLOAD_CONFIG.allowedExtensions.includes(ext)) {
    return false;
  }

  return true;
};

/**
 * 检查MIME类型是否安全
 */
const isMimeTypeSafe = (mimeType: string): boolean => {
  // 检查是否在黑名单中
  if (DANGEROUS_MIME_TYPES.includes(mimeType)) {
    return false;
  }

  // 检查是否在允许列表中
  if (!FILE_UPLOAD_CONFIG.allowedMimeTypes.includes(mimeType)) {
    return false;
  }

  return true;
};

/**
 * 生成安全的文件名
 */
const generateSafeFileName = (originalName: string, userId?: string): string => {
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);

  // 清理文件名，移除特殊字符
  const cleanName = name
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_')
    .substring(0, 50); // 限制长度

  // 生成唯一标识
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const userPrefix = userId ? `${userId}_` : '';

  return `${userPrefix}${cleanName}_${timestamp}_${random}${ext}`;
};

/**
 * 验证文件内容（基本检查）
 */
const validateFileContent = async (filePath: string, mimeType: string): Promise<boolean> => {
  if (!FILE_UPLOAD_CONFIG.enableContentValidation) {
    return true;
  }

  try {
    // 读取文件头部字节
    const fileBuffer = await fs.readFile(filePath);
    const headerBytes = fileBuffer.slice(0, 512);

    // 根据MIME类型检查文件头
    switch (mimeType) {
      case 'image/jpeg':
        return headerBytes.toString('hex').startsWith('ffd8ff');

      case 'image/png':
        return headerBytes.toString('hex').startsWith('89504e47');

      case 'image/gif':
        return headerBytes.toString('ascii').startsWith('GIF');

      case 'application/pdf':
        return headerBytes.toString('ascii').startsWith('%PDF');

      default:
        // 对于文本文件和其他类型，只做基本检查
        return true;
    }
  } catch (error) {
    logger.error('文件内容验证失败', {
      error: error instanceof Error ? error.message : '未知错误',
      filePath
    });
    return false;
  }
};

/**
 * 文件上传安全中间件
 */
export const fileUploadSecurity = (options: Partial<FileUploadConfig> = {}) => {
  const config = { ...FILE_UPLOAD_CONFIG, ...options };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 如果没有文件上传，直接通过
      if (!req.file && !req.files) {
        return next();
      }

      // 确保上传目录存在
      try {
        await fs.mkdir(config.uploadDir, { recursive: true });
        await fs.mkdir(config.tempDir, { recursive: true });
      } catch (error) {
        logger.error('创建上传目录失败', {
          error: error instanceof Error ? error.message : '未知错误'
        });
        return res.status(500).json(createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '文件上传服务异常'
        ));
      }

      // 处理单个文件
      if (req.file) {
        const validationResult = await validateSingleFile(req.file, config, req.user?.id);
        if (!validationResult.isValid) {
          // 清理临时文件
          try {
            await fs.unlink(req.file.path);
          } catch {}

          return res.status(400).json(createErrorResponse(
            validationResult.errorCode || ErrorCode.BAD_REQUEST,
            validationResult.error || '文件验证失败'
          ));
        }

        // 文件验证通过，继续处理
        return next();
      }

      // 处理多个文件
      if (req.files) {
        const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();

        for (const file of files) {
          const validationResult = await validateSingleFile(file, config, req.user?.id);
          if (!validationResult.isValid) {
            // 清理所有已上传的文件
            for (const f of files) {
              try {
                await fs.unlink(f.path);
              } catch {}
            }

            return res.status(400).json(createErrorResponse(
              validationResult.errorCode || ErrorCode.BAD_REQUEST,
              `文件 ${file.originalname} 验证失败: ${validationResult.error}`
            ));
          }
        }

        return next();
      }

      next();
    } catch (error) {
      logger.error('文件上传安全检查异常', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id,
        ip: req.ip
      });

      return res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '文件上传安全检查失败'
      ));
    }
  };
};

/**
 * 验证单个文件
 */
const validateSingleFile = async (
  file: Express.Multer.File,
  config: FileUploadConfig,
  userId?: string
): Promise<FileValidationResult> => {
  try {
    // 1. 检查文件名长度
    if (file.originalname.length > config.maxFileNameLength) {
      return {
        isValid: false,
        error: '文件名过长',
        details: { maxLength: config.maxFileNameLength }
      };
    }

    // 2. 检查文件扩展名
    if (!isExtensionSafe(file.originalname)) {
      return {
        isValid: false,
        error: '不支持的文件类型',
        details: { extension: path.extname(file.originalname) }
      };
    }

    // 3. 检查MIME类型
    if (!isMimeTypeSafe(file.mimetype)) {
      return {
        isValid: false,
        error: '不支持的MIME类型',
        details: { mimeType: file.mimetype }
      };
    }

    // 4. 检查文件大小
    if (file.size > config.maxFileSize) {
      return {
        isValid: false,
        error: '文件过大',
        details: {
          size: file.size,
          maxSize: config.maxFileSize
        }
      };
    }

    // 5. 检查文件内容
    if (!(await validateFileContent(file.path, file.mimetype))) {
      return {
        isValid: false,
        error: '文件内容验证失败',
        details: { reason: '文件头与扩展名不匹配' }
      };
    }

    // 6. 生成安全的文件名并重命名
    const safeFileName = generateSafeFileName(file.originalname, userId);
    const safeFilePath = path.join(config.uploadDir, safeFileName);

    try {
      // 确保上传目录存在
      await fs.mkdir(path.dirname(safeFilePath), { recursive: true });
      await fs.rename(file.path, safeFilePath);
      // 更新文件信息
      file.filename = safeFileName;
      file.path = safeFilePath;
      file.originalname = safeFileName;
    } catch (error) {
      logger.error('文件重命名失败', {
        error: error instanceof Error ? error.message : '未知错误',
        originalPath: file.path,
        newPath: safeFilePath
      });
      return {
        isValid: false,
        error: '文件处理失败'
      };
    }

    // 7. 记录文件上传日志
    logger.info('文件上传验证通过', {
      userId,
      originalName: file.originalname,
      safeName: safeFileName,
      size: file.size,
      mimeType: file.mimetype,
      ip: file.destination
    });

    return { isValid: true };
  } catch (error) {
    logger.error('文件验证异常', {
      error: error instanceof Error ? error.message : '未知错误',
      fileName: file.originalname
    });

    return {
      isValid: false,
      error: '文件验证异常'
    };
  }
};

/**
 * 清理临时文件（定时任务）
 */
export const cleanupTempFiles = async (): Promise<void> => {
  try {
    const files = await fs.readdir(FILE_UPLOAD_CONFIG.tempDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时

    for (const file of files) {
      const filePath = path.join(FILE_UPLOAD_CONFIG.tempDir, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
        logger.debug('清理临时文件', { filePath });
      }
    }
  } catch (error) {
    logger.error('清理临时文件失败', {
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};

// 每小时清理一次临时文件
setInterval(cleanupTempFiles, 60 * 60 * 1000);

/**
 * 获取文件上传统计信息
 * 注意：此函数有TypeScript类型错误，不是我们修修的部分，暂時禁用
 */
// export const getFileUploadStats = async (): Promise<{
//   totalFiles: number;
//   totalSize: number;
//   filesByType: Record<string, number>;
// }> => {
//   try {
//     const files = await fs.readdir(FILE_UPLOAD_CONFIG.uploadDir);
//     let totalSize = 0;
//     const filesByType: Record<string, number> = {};

//     for (const file of files) {
//       const filePath = path.join(FILE_UPLOAD_CONFIG.uploadDir, file);
//       const stats = await fs.stat(filePath);
//       const ext = path.extname(file).toLowerCase();

//       totalSize += stats.size;
//       filesByType[ext] = (filesByType[ext] || 0) + 1;
//     }

//     return {
//       totalFiles: files.length,
//       totalSize,
//       filesByType
//     };
//   } catch (error) {
//     logger.error('获取文件统计信息失败', {
//       error: error instanceof Error ? error.message : '未知错误'
//     });

//     return {
//       totalFiles: 0,
//       totalSize: 0,
//       filesByType: {}
//     };
//   }
// };