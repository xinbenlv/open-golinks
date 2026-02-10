/**
 * 链接测试数据
 */

export const VALID_LINKS = [
  {
    slug: 'example',
    url: 'https://example.com',
  },
  {
    slug: 'google',
    url: 'https://google.com',
  },
  {
    slug: 'my-link-123',
    url: 'https://example.com/very-long-path',
  },
];

export const INVALID_LINKS = [
  {
    slug: 'ab', // 太短
    url: 'https://example.com',
  },
  {
    slug: '-invalid', // 以连字符开头
    url: 'https://example.com',
  },
  {
    slug: 'invalid-', // 以连字符结尾
    url: 'https://example.com',
  },
  {
    slug: 'UPPERCASE', // 不是小写
    url: 'https://example.com',
  },
  {
    slug: 'api', // 保留的 slug
    url: 'https://example.com',
  },
];

export const VALID_URLS = [
  'https://example.com',
  'https://example.com/path',
  'https://example.com/path?query=value',
  'http://example.com',
  'https://example.com:8080',
  'https://sub.example.com',
];

export const INVALID_URLS = [
  'not-a-url',
  'ftp://example.com', // 不支持的协议
  'https://192.168.1.1', // 私有 IP
  'https://10.0.0.1', // 私有 IP
  'https://localhost', // localhost
  'https://127.0.0.1', // loopback
];
