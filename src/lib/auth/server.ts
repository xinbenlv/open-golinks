import { createServerClient } from '@supabase/ssr';

/**
 * 创建 Supabase 服务器客户端
 * 用于后端 API 路由和服务器组件
 */
export function getSupabaseServerClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Next.js 服务器端 cookies 获取实现
          return [];
        },
        setAll(cookiesToSet) {
          // Next.js 服务器端 cookies 设置实现
          return cookiesToSet;
        },
      },
    }
  );
}

/**
 * 获取当前认证用户（服务器端）
 */
export async function getCurrentUser() {
  const supabase = getSupabaseServerClient();
  try {
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * 验证用户认证状态（服务器端）
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
