/**
 * 保留的系统 slug 列表
 * 这些 slug 不能被用户创建
 * 来源：v2 规范 Section 3.2
 */

export const RESERVED_SLUGS = [
  // 系统路由
  'api',
  'admin',
  'dashboard',
  'login',
  'logout',
  'register',
  'profile',
  'settings',
  'signin',
  'signup',
  'auth',
  'account',

  // 功能路由
  'edit',
  'warn',
  'history',
  'stats',
  'analytics',
  'share',
  'export',
  'import',
  'claim',
  'transfer',
  'delete',
  'remove',
  'verify',
  'confirm',

  // 健康检查和监控
  'health',
  'ping',
  'status',
  'metrics',
  'logs',

  // 静态资源
  'favicon',
  'robots',
  'sitemap',
  'assets',
  'static',
  'public',
  'images',
  'css',
  'js',

  // 技术路由
  'api',
  '_next',
  '__next',
  '.well-known',

  // 社交和营销
  'twitter',
  'facebook',
  'instagram',
  'linkedin',
  'github',
  'contact',
  'about',
  'help',
  'docs',
  'blog',
  'news',
  'press',

  // 法律和隐私
  'privacy',
  'terms',
  'legal',
  'disclaimer',
  'cookies',

  // 保留用于未来使用
  'api-v2',
  'api-v3',
  'webhooks',
  'callback',
  'redirect',
  'proxy',
  'bridge',

  // 其他常见冲突
  'www',
  'mail',
  'ftp',
  'sftp',
  'ssh',
  'telnet',
  'smtp',
  'pop',
  'imap',
  'localhost',
  '127.0.0.1',
];

export const RESERVED_SLUGS_SET = new Set(RESERVED_SLUGS);

/**
 * 检查 slug 是否被保留
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS_SET.has(slug.toLowerCase());
}
