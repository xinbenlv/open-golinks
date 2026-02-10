import type { ApiSuccessResponse, ApiErrorResponse } from '@/types/api';

/**
 * 创建成功响应
 */
export function successResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 创建错误响应
 */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * 创建分页响应
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): ApiSuccessResponse<{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  return successResponse({
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  });
}
