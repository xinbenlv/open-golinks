import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Input } from './Input';

/**
 * Input 原子组件故事
 * 展示 Input 组件的各种状态和变体
 */
const meta = {
  title: 'Atoms/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Input 组件提供了一个灵活的文本输入实现，支持错误状态和加载状态。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      description: '输入框类型',
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'url'],
    },
    placeholder: {
      description: '占位符文本',
      control: 'text',
    },
    disabled: {
      description: '是否禁用',
      control: 'boolean',
    },
    error: {
      description: '错误信息',
      control: 'text',
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 默认输入框
 */
export const Default: Story = {
  args: {
    placeholder: '输入内容...',
    type: 'text',
  },
};

/**
 * 聚焦状态
 */
export const Focused: Story = {
  args: {
    placeholder: '输入内容...',
    autoFocus: true,
  },
};

/**
 * 禁用状态
 */
export const Disabled: Story = {
  args: {
    placeholder: '禁用的输入框',
    disabled: true,
    value: '禁用状态',
  },
};

/**
 * 错误状态
 */
export const WithError: Story = {
  args: {
    placeholder: '输入邮箱...',
    error: '邮箱格式不正确',
    type: 'email',
    value: 'invalid-email',
  },
};

/**
 * 邮箱输入框
 */
export const EmailInput: Story = {
  args: {
    placeholder: '请输入邮箱地址',
    type: 'email',
  },
};

/**
 * 密码输入框
 */
export const PasswordInput: Story = {
  args: {
    placeholder: '请输入密码',
    type: 'password',
  },
};

/**
 * 数字输入框
 */
export const NumberInput: Story = {
  args: {
    placeholder: '请输入数字',
    type: 'number',
  },
};

/**
 * 搜索输入框
 */
export const SearchInput: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <Input
        type="text"
        placeholder="搜索..."
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
      />
    );
  },
};

/**
 * 所有输入类型
 */
export const AllInputTypes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-96">
      <Input type="text" placeholder="文本输入" />
      <Input type="email" placeholder="邮箱输入" />
      <Input type="password" placeholder="密码输入" />
      <Input type="number" placeholder="数字输入" />
      <Input type="url" placeholder="URL输入" />
    </div>
  ),
};

/**
 * 所有状态组合
 */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-96">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          正常状态
        </label>
        <Input placeholder="输入内容..." />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          聚焦状态
        </label>
        <Input placeholder="输入内容..." autoFocus />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          禁用状态
        </label>
        <Input placeholder="禁用输入框" disabled />
      </div>
      <div>
        <label className="text-sm font-medium text-error block mb-1">
          错误状态
        </label>
        <Input
          placeholder="输入邮箱..."
          error="邮箱格式不正确"
          value="invalid"
        />
      </div>
    </div>
  ),
};

/**
 * 带前缀的搜索框
 */
export const SearchBox: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="relative w-96">
        <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
        <Input
          type="text"
          placeholder="搜索..."
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          className="pl-10"
        />
      </div>
    );
  },
};
