import { createWriteStream, WriteStream } from 'fs';
import { join } from 'path';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  requestId?: string;
  userId?: string;
}

class Logger {
  private logFile: WriteStream;
  private logLevel: LogLevel;

  constructor() {
    // 确保日志目录存在
    const logDir = join(process.cwd(), 'logs');
    require('fs').mkdirSync(logDir, { recursive: true });

    // 创建日志文件流
    const logFilePath = join(logDir, `app-${process.env.NODE_ENV || 'development'}.log`);
    this.logFile = createWriteStream(logFilePath, { flags: 'a' });

    // 设置日志级别
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatLog(entry: LogEntry): string {
    return JSON.stringify(entry) + '\n';
  }

  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const formattedLog = this.formatLog(entry);

    // 写入文件
    this.logFile.write(formattedLog);

    // 开发环境下同时输出到控制台
    if (process.env.NODE_ENV === 'development') {
      const colors = {
        [LogLevel.ERROR]: '\x1b[31m', // 红色
        [LogLevel.WARN]: '\x1b[33m',  // 黄色
        [LogLevel.INFO]: '\x1b[36m',  // 青色
        [LogLevel.DEBUG]: '\x1b[37m' // 白色
      };

      const color = colors[entry.level];
      const reset = '\x1b[0m';

// [DEBUG REMOVED]       console.log(`${color}[${entry.level.toUpperCase()}]${reset} ${entry.message}`);

      if (entry.data) {
// [DEBUG REMOVED]         console.log(`${color}Data:${reset}`, entry.data);
      }
    }
  }

  error(message: string, data?: any, requestId?: string, userId?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      data,
      requestId,
      userId
    });
  }

  warn(message: string, data?: any, requestId?: string, userId?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message,
      data,
      requestId,
      userId
    });
  }

  info(message: string, data?: any, requestId?: string, userId?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message,
      data,
      requestId,
      userId
    });
  }

  debug(message: string, data?: any, requestId?: string, userId?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      data,
      requestId,
      userId
    });
  }

  // 业务日志
  userAction(action: string, userId: string, data?: any, requestId?: string): void {
    this.info(`用户操作: ${action}`, {
      action,
      userId,
      ...data
    }, requestId, userId);
  }

  // API请求日志
  apiRequest(method: string, url: string, userId?: string, requestId?: string): void {
    this.debug(`API请求: ${method} ${url}`, {
      method,
      url,
      userId
    }, requestId, userId);
  }

  // 数据库操作日志
  dbOperation(operation: string, table: string, data?: any, requestId?: string): void {
    this.debug(`数据库操作: ${operation} on ${table}`, {
      operation,
      table,
      ...data
    }, requestId);
  }

  // 安全日志
  security(event: string, userId?: string, data?: any, requestId?: string): void {
    this.warn(`安全事件: ${event}`, {
      event,
      userId,
      ...data
    }, requestId, userId);
  }
}

export const logger = new Logger();
export default logger;