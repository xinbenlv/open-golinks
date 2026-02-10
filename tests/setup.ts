import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * 测试设置
 * 为所有测试配置全局环境和清理
 */

// 每个测试前重置所有模拟
beforeEach(() => {
  vi.clearAllMocks();
});

// 每个测试后清理
afterEach(() => {
  cleanup();
});

// 模拟环境变量
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.IP_HASH_SALT = 'test-salt-for-unit-tests-12345678';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// 全局 fetch 模拟
global.fetch = vi.fn();

// 模拟 crypto 对象（如果需要）
if (!global.crypto) {
  global.crypto = {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  } as any;
}

// 模拟 matchMedia（用于响应式设计测试）
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
