import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

/**
 * Badge 原子组件故事
 * 展示 Badge 组件的各种样式变体
 */
const meta = {
  title: 'Atoms/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Badge 组件用于展示标签、状态或分类信息。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      description: 'Badge 样式变体',
      control: 'select',
      options: ['primary', 'success', 'error', 'warning', 'gray'],
    },
    children: {
      description: 'Badge 文本内容',
      control: 'text',
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 主要 Badge (Primary)
 */
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: '主要',
  },
};

/**
 * 成功 Badge (Success)
 */
export const Success: Story = {
  args: {
    variant: 'success',
    children: '成功',
  },
};

/**
 * 错误 Badge (Error)
 */
export const Error: Story = {
  args: {
    variant: 'error',
    children: '错误',
  },
};

/**
 * 警告 Badge (Warning)
 */
export const Warning: Story = {
  args: {
    variant: 'warning',
    children: '警告',
  },
};

/**
 * 灰色 Badge (Gray)
 */
export const Gray: Story = {
  args: {
    variant: 'gray',
    children: '默认',
  },
};

/**
 * 所有变体
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <Badge variant="primary">主要</Badge>
      <Badge variant="success">成功</Badge>
      <Badge variant="error">错误</Badge>
      <Badge variant="warning">警告</Badge>
      <Badge variant="gray">默认</Badge>
    </div>
  ),
};

/**
 * Badge 组合示例
 */
export const BadgeCombinations: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">状态标签</h3>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="success">✓ 已完成</Badge>
          <Badge variant="warning">⚠ 待处理</Badge>
          <Badge variant="error">✕ 已关闭</Badge>
          <Badge variant="primary">i 进行中</Badge>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">分类标签</h3>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="primary">React</Badge>
          <Badge variant="primary">TypeScript</Badge>
          <Badge variant="primary">Storybook</Badge>
          <Badge variant="gray">其他</Badge>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">优先级标签</h3>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="error">高优先级</Badge>
          <Badge variant="warning">中优先级</Badge>
          <Badge variant="success">低优先级</Badge>
        </div>
      </div>
    </div>
  ),
};
