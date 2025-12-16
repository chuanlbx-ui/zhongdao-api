import { Response } from 'express';

interface SuccessResponse {
  success: true;
  message: string;
  data: any;
  timestamp: string;
}

interface ErrorResponse {
  success: false;
  message: string;
  error?: {
    code: number;
    message: string;
  };
  timestamp: string;
}

// 成功响应
export const success = (res: Response, data: any, message: string = 'Success') => {
  const response: SuccessResponse = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  return res.status(200).json(response);
};

// 错误响应
export const error = (res: Response, message: string = 'Error', code: number = 400) => {
  const response: ErrorResponse = {
    success: false,
    message,
    error: {
      code,
      message
    },
    timestamp: new Date().toISOString()
  };
  return res.status(code).json(response);
};

// 验证错误
export const validationError = (res: Response, errors: any[]) => {
  const response: ErrorResponse = {
    success: false,
    message: 'Validation failed',
    error: {
      code: 422,
      message: errors.join(', ')
    },
    timestamp: new Date().toISOString()
  };
  return res.status(422).json(response);
};

// 未找到
export const notFound = (res: Response, message: string = 'Resource not found') => {
  const response: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };
  return res.status(404).json(response);
};

// 未授权
export const unauthorized = (res: Response, message: string = 'Unauthorized') => {
  const response: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };
  return res.status(401).json(response);
};

// 禁止访问
export const forbidden = (res: Response, message: string = 'Forbidden') => {
  const response: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };
  return res.status(403).json(response);
};

// 服务器错误
export const serverError = (res: Response, message: string = 'Internal server error') => {
  const response: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };
  return res.status(500).json(response);
};