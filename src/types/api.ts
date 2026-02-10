// API 请求/响应类型定义

// ============ 链接创建 ============
export interface CreateLinkRequest {
  slug?: string; // 可选，自动生成如果未提供
  url: string;
  customSlug?: boolean;
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
    showWarning?: boolean;
  };
  turnstileToken?: string; // 机器人验证令牌
}

export interface CreateLinkResponse {
  slug: string;
  url: string;
  shortUrl: string;
  createdAt: string;
  ownerId?: string;
}

// ============ 链接解析 ============
export interface ResolveLinkRequest {
  slug: string;
}

export interface ResolveLinkResponse {
  slug: string;
  url: string;
  public: boolean;
  visits: number;
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
  };
}

// ============ 声明链接 ============
export interface ClaimLinkRequest {
  slug: string;
  email?: string;
  fingerprint?: string;
}

export interface ClaimLinkResponse {
  slug: string;
  claimToken?: string;
  message: string;
}

// ============ 更新链接 ============
export interface UpdateLinkRequest {
  slug: string;
  url?: string;
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
    showWarning?: boolean;
  };
}

export interface UpdateLinkResponse {
  slug: string;
  url: string;
  updatedAt: string;
}

// ============ 标准响应格式 ============
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============ 分页响应 ============
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
