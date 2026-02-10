import type { Preview } from '@storybook/react';
import '../src/styles/globals.css';

/**
 * Storybook 全局预览配置
 * 定义全局主题、装饰器和参数
 */
const preview: Preview = {
  parameters: {
    layout: 'centered',
    docs: {
      toc: true,
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'aria-allowed-attr',
            enabled: true,
          },
        ],
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="p-8 bg-gray-50 min-h-screen">
        <Story />
      </div>
    ),
  ],
};

export default preview;
