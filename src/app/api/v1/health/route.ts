import { successResponse } from '@/lib/api/responses';

/**
 * GET /api/v1/health
 * 健康检查端点
 */
export async function GET(): Promise<Response> {
  const data = {
    status: 'ok',
    version: 'v1',
    timestamp: new Date().toISOString(),
  };

  return Response.json(successResponse(data));
}
