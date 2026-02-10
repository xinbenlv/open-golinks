import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

/**
 * Button 原子组件故事
 * 展示 Button 组件的所有变体、尺寸和交互状态
 *
 * 特性：
 * - 4 种主要变体（primary, secondary, ghost, danger）
 * - 3 种尺寸（sm, md, lg）
 * - 加载状态（isLoading）
 * - 禁用状态（disabled）
 * - 图标支持
 */
const meta = {
  title: 'Atoms/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Button 组件提供了一个灵活、可访问的按钮实现，支持多种样式变体和交互状态。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      description: '按钮样式变体',
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: {
      description: '按钮尺寸',
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    isLoading: {
      description: '是否显示加载状态',
      control: 'boolean',
    },
    disabled: {
      description: '是否禁用按钮',
      control: 'boolean',
    },
    children: {
      description: '按钮文本内容',
      control: 'text',
    },
    onClick: { action: 'clicked' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 主按钮 (Primary)
 * 用于主要操作，如提交表单或确认重要操作
 */
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: '主按钮',
  },
};

/**
 * 次按钮 (Secondary)
 * 用于次要操作，如返回或取消
 */
export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: '次按钮',
  },
};

/**
 * 幽灵按钮 (Ghost)
 * 用于不需要突出的操作
 */
export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: '幽灵按钮',
  },
};

/**
 * 危险按钮 (Danger)
 * 用于删除或危险操作
 */
export const Danger: Story = {
  args: {
    variant: 'danger',
    children: '删除',
  },
};

/**
 * 小尺寸按钮
 */
export const Small: Story = {
  args: {
    variant: 'primary',
    size: 'sm',
    children: '小按钮',
  },
};

/**
 * 中等尺寸按钮（默认）
 */
export const Medium: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    children: '中等按钮',
  },
};

/**
 * 大尺寸按钮
 */
export const Large: Story = {
  args: {
    variant: 'primary',
    size: 'lg',
    children: '大按钮',
  },
};

/**
 * 加载状态按钮
 * 显示旋转动画并禁用交互
 */
export const Loading: Story = {
  args: {
    variant: 'primary',
    isLoading: true,
    children: '加载中...',
  },
};

/**
 * 禁用状态按钮
 * 不可交互且视觉上灰显
 */
export const Disabled: Story = {
  args: {
    variant: 'primary',
    disabled: true,
    children: '禁用',
  },
};

/**
 * 所有变体尺寸组合
 */
export const AllVariantsSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div className="flex gap-4 items-center flex-wrap">
        <Button variant="primary" size="sm">
          Primary SM
        </Button>
        <Button variant="primary" size="md">
          Primary MD
        </Button>
        <Button variant="primary" size="lg">
          Primary LG
        </Button>
      </div>
      <div className="flex gap-4 items-center flex-wrap">
        <Button variant="secondary" size="sm">
          Secondary SM
        </Button>
        <Button variant="secondary" size="md">
          Secondary MD
        </Button>
        <Button variant="secondary" size="lg">
          Secondary LG
        </Button>
      </div>
      <div className="flex gap-4 items-center flex-wrap">
        <Button variant="ghost" size="sm">
          Ghost SM
        </Button>
        <Button variant="ghost" size="md">
          Ghost MD
        </Button>
        <Button variant="ghost" size="lg">
          Ghost LG
        </Button>
      </div>
      <div className="flex gap-4 items-center flex-wrap">
        <Button variant="danger" size="sm">
          Danger SM
        </Button>
        <Button variant="danger" size="md">
          Danger MD
        </Button>
        <Button variant="danger" size="lg">
          Danger LG
        </Button>
      </div>
    </div>
  ),
};

/**
 * 所有状态组合
 */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Button variant="primary">正常状态</Button>
      <Button variant="primary" isLoading>
        加载状态
      </Button>
      <Button variant="primary" disabled>
        禁用状态
      </Button>
      <Button variant="danger">危险状态</Button>
      <Button variant="danger" disabled>
        禁用危险状态
      </Button>
    </div>
  ),
};
