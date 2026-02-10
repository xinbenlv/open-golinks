import type { StorybookConfig } from '@storybook/react/webpack5';
import path from 'path';

/**
 * Storybook 主配置文件
 * 配置 Storybook 的核心功能、插件和故事加载规则
 */
const config: StorybookConfig = {
  framework: '@storybook/react',
  stories: ['../src/**/*.stories.tsx'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  docs: {
    autodocs: 'tag',
  },
  webpackFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@': path.resolve(__dirname, '../src'),
      };
    }
    return config;
  },
};

export default config;
