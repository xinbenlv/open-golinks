import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

/**
 * Card 原子组件故事
 * 展示 Card 组件的各种用法
 */
const meta = {
  title: 'Atoms/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Card 组件用于展示内容的容器，支持交互和自定义样式。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    interactive: {
      description: '是否为交互式卡片（显示悬停效果）',
      control: 'boolean',
    },
    children: {
      description: '卡片内容',
      control: 'text',
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 基础卡片
 */
export const Default: Story = {
  args: {
    children: '这是一个基础卡片',
  },
};

/**
 * 交互式卡片
 */
export const Interactive: Story = {
  args: {
    interactive: true,
    children: '这是一个交互式卡片',
  },
};

/**
 * 带内容的卡片
 */
export const WithContent: Story = {
  render: () => (
    <Card className="max-w-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        卡片标题
      </h3>
      <p className="text-gray-600 text-sm mb-4">
        这是卡片的描述文本，可以包含任何内容。
      </p>
      <button className="text-primary hover:text-primary-dark text-sm font-medium">
        了解更多 →
      </button>
    </Card>
  ),
};

/**
 * 交互式卡片带内容
 */
export const InteractiveWithContent: Story = {
  render: () => (
    <Card
      interactive
      className="max-w-sm cursor-pointer"
      onClick={() => console.log('Card clicked')}
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        可点击的卡片
      </h3>
      <p className="text-gray-600 text-sm mb-4">
        点击此卡片可触发操作。
      </p>
      <span className="text-primary text-sm font-medium">点击查看详情 →</span>
    </Card>
  ),
};

/**
 * 卡片网格布局
 */
export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
      <Card className="cursor-pointer hover:shadow-lg transition-shadow">
        <div className="text-3xl mb-2">📝</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          短链接
        </h3>
        <p className="text-gray-600 text-sm">
          快速创建简洁的短链接
        </p>
      </Card>
      <Card className="cursor-pointer hover:shadow-lg transition-shadow">
        <div className="text-3xl mb-2">📊</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          统计数据
        </h3>
        <p className="text-gray-600 text-sm">
          实时查看链接访问统计
        </p>
      </Card>
      <Card className="cursor-pointer hover:shadow-lg transition-shadow">
        <div className="text-3xl mb-2">🔒</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          安全保护
        </h3>
        <p className="text-gray-600 text-sm">
          完整的访问控制和保护
        </p>
      </Card>
    </div>
  ),
};

/**
 * 卡片变体示例
 */
export const CardVariations: Story = {
  render: () => (
    <div className="flex flex-col gap-6 w-full max-w-2xl">
      <Card>
        <h3 className="text-base font-semibold text-gray-900">基础卡片</h3>
      </Card>
      <Card interactive className="hover:border-primary">
        <h3 className="text-base font-semibold text-gray-900">
          交互式卡片
        </h3>
        <p className="text-sm text-gray-600 mt-2">
          有悬停效果的交互式卡片
        </p>
      </Card>
      <Card className="border-2 border-primary">
        <h3 className="text-base font-semibold text-primary">强调卡片</h3>
      </Card>
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
        <h3 className="text-base font-semibold text-gray-900">
          渐变背景卡片
        </h3>
      </Card>
    </div>
  ),
};

/**
 * 图片卡片
 */
export const ImageCard: Story = {
  render: () => (
    <Card className="max-w-xs overflow-hidden">
      <div className="bg-gradient-to-br from-blue-400 to-blue-600 h-32 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        图片卡片
      </h3>
      <p className="text-gray-600 text-sm mb-4">
        这是一个包含图片的卡片示例
      </p>
      <button className="text-primary hover:text-primary-dark text-sm font-medium">
        查看更多
      </button>
    </Card>
  ),
};
