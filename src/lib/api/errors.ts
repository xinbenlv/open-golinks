import { ErrorCode, getErrorMessage, getHttpStatusCode } from '@/lib/constants/errors';

/**
 * 自定义 API 错误类
 */
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number = getHttpStatusCode(code),
    public details?: Record<string, unknown>
  ) {
    const message = getErrorMessage(code);
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 创建 API 错误
 */
export function createError(
  code: ErrorCode,
  statusCode?: number,
  details?: Record<string, unknown>
): ApiError {
  return new ApiError(code, statusCode, details);
}

/**
 * 检查对象是否为 ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * 将错误转换为 API 响应
 */
export function errorToResponse(error: unknown) {
  if (isApiError(error)) {
    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        },
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 未知错误
  return {
    statusCode: 500,
    body: {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: getErrorMessage(ErrorCode.INTERNAL_ERROR),
      },
      timestamp: new Date().toISOString(),
    },
  };
}
