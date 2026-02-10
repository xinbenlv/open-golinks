import { nanoid } from 'nanoid';

/**
 * 生成随机有效的 slug
 * 长度默认为 8 个字符
 */
export function generateRandomSlug(length: number = 8): string {
  // 生成包含字母和数字的随机字符串
  // nanoid 默认使用 A-Za-z0-9_- 字符
  const randomString = nanoid(length).toLowerCase();

  // 确保符合规则：以字母或数字开头和结尾，中间可以包含连字符
  // 简单做法：替换任何非法字符为字母
  return randomString.replace(/[^a-z0-9]/g, (match) => {
    // 替换非字母数字的字符为随机字母
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return chars[Math.floor(Math.random() * chars.length)];
  });
}

/**
 * 从 URL 生成 slug 建议
 * 从 URL 路径或标题中提取有意义的词
 */
export function generateSlugFromURL(url: string): string {
  try {
    const parsed = new URL(url);
    // 从路径中提取最后一个有意义的部分
    const pathParts = parsed.pathname.split('/').filter((p) => p.length > 0);
    const lastPart = pathParts[pathParts.length - 1];

    if (lastPart && lastPart.length >= 3 && lastPart.length <= 50) {
      // 清理：移除文件扩展名和特殊字符
      const slug = lastPart
        .split('.')[0] // 移除扩展名
        .replace(/[^a-z0-9-]/gi, '') // 移除非法字符
        .toLowerCase();

      if (slug.length >= 3) {
        return slug;
      }
    }
  } catch {
    // 无法解析 URL
  }

  // 如果无法从 URL 提取，生成随机 slug
  return generateRandomSlug();
}

/**
 * 生成唯一的 slug（需要数据库检查）
 * 注意：这需要在 API 层与数据库集成
 */
export function generateUniqueSlug(baseSlugs: string[], maxAttempts: number = 10): string {
  const baseSlugsSet = new Set(baseSlugs.map((s) => s.toLowerCase()));

  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateRandomSlug();
    if (!baseSlugsSet.has(candidate)) {
      return candidate;
    }
  }

  // 如果重试次数过多，返回带时间戳的 slug
  const timestamp = Date.now().toString(36).slice(-6);
  return `slug-${timestamp}`;
}
