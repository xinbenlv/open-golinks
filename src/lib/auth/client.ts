import { createBrowserClient } from '@supabase/ssr';

/**
 * 创建 Supabase 浏览器客户端
 * 用于客户端组件和浏览器操作
 */
export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * 在客户端创建匿名指纹
 * 用于跟踪匿名用户
 */
export function generateClientFingerprint(): string {
  const ua = navigator.userAgent;
  const language = navigator.language;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const combined = `${ua}::${language}::${timezone}`;

  // 简单的哈希实现（生产环境应使用更强的哈希）
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
