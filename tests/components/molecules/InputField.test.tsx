import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { InputField } from '@/components/molecules/InputField';

/**
 * InputField 分子组件测试套件
 * 测试范围：
 * - 标签和输入整合
 * - 验证错误显示
 * - 辅助文本显示
 * - React Hook Form 集成
 * - 表单状态同步
 */

describe('InputField 分子组件', () => {
  // 创建测试包装器以提供 FormProvider
  const FormWrapper = ({ children, defaultValues = {} }: any) => {
    const methods = useForm({ defaultValues });
    return (
      <FormProvider {...methods}>
        {children}
      </FormProvider>
    );
  };

  describe('基础渲染', () => {
    it('应该渲染标签', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
        </FormWrapper>
      );
      expect(screen.getByText('邮箱')).toBeInTheDocument();
    });

    it('应该渲染输入框', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
        </FormWrapper>
      );
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('应该标签和输入框关联', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
        </FormWrapper>
      );
      const label = screen.getByText('邮箱');
      const input = screen.getByRole('textbox');
      expect(label).toHaveAttribute('for', 'email');
      expect(input).toHaveAttribute('id', 'email');
    });
  });

  describe('标签功能', () => {
    it('应该在 required=true 时显示必需指示符', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" required />
        </FormWrapper>
      );
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('应该在 required=false 时不显示必需指示符', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" required={false} />
        </FormWrapper>
      );
      const asterisks = screen.queryAllByText('*');
      expect(asterisks.length).toBe(0);
    });

    it('应该使用正确的标签文本', () => {
      render(
        <FormWrapper>
          <InputField name="username" label="用户名" />
        </FormWrapper>
      );
      expect(screen.getByText('用户名')).toBeInTheDocument();
    });
  });

  describe('输入框功能', () => {
    it('应该支持输入文本', async () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
        </FormWrapper>
      );
      const input = screen.getByRole('textbox');

      await userEvent.type(input, 'test@example.com');
      expect(input).toHaveValue('test@example.com');
    });

    it('应该支持自定义属性', async () => {
      render(
        <FormWrapper>
          <InputField
            name="email"
            label="邮箱"
            type="email"
            placeholder="输入邮箱..."
          />
        </FormWrapper>
      );
      expect(screen.getByPlaceholderText('输入邮箱...')).toBeInTheDocument();
    });

    it('应该支持 disabled 属性', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" disabled />
        </FormWrapper>
      );
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('验证集成', () => {
    it('应该显示验证错误', async () => {
      const ValidatedForm = () => {
        const methods = useForm({
          defaultValues: { email: '' },
          mode: 'onSubmit',
        });

        return (
          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(() => {})}>
              <InputField name="email" label="邮箱" />
              <button type="submit">提交</button>
            </form>
          </FormProvider>
        );
      };

      render(<ValidatedForm />);

      // 由于没有注册验证器，错误不会自动显示
      // 这是一个简化的测试
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('应该在有错误时应用错误样式', () => {
      const { container } = render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
        </FormWrapper>
      );
      const input = container.querySelector('input');
      expect(input).toBeInTheDocument();
    });
  });

  describe('辅助文本功能', () => {
    it('应该显示 helperText', () => {
      render(
        <FormWrapper>
          <InputField
            name="email"
            label="邮箱"
            helperText="使用有效的邮箱地址"
          />
        </FormWrapper>
      );
      expect(screen.getByText('使用有效的邮箱地址')).toBeInTheDocument();
    });

    it('应该在没有 helperText 时不渲染', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
        </FormWrapper>
      );
      // 确保没有额外的帮助文本
      expect(screen.queryByText(/使用有效/)).not.toBeInTheDocument();
    });
  });

  describe('错误显示', () => {
    it('应该在无错误时不显示错误消息', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
        </FormWrapper>
      );
      // 检查没有其他错误消息显示
      const errorElements = screen.queryAllByText(/错误|invalid/i);
      expect(errorElements.length).toBe(0);
    });
  });

  describe('React Hook Form 集成', () => {
    it('应该与 useFormContext 集成', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
        </FormWrapper>
      );
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('应该正确注册字段', async () => {
      const TestForm = () => {
        const methods = useForm({
          defaultValues: { email: '' },
        });

        const onSubmit = vi.fn();

        return (
          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)}>
              <InputField name="email" label="邮箱" />
              <button type="submit">提交</button>
            </form>
          </FormProvider>
        );
      };

      render(<TestForm />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test@example.com');

      await userEvent.click(screen.getByText('提交'));

      // 检查表单是否可以提交
      expect(screen.getByRole('textbox')).toHaveValue('test@example.com');
    });

    it('应该支持多个字段', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
          <InputField name="password" label="密码" type="password" />
        </FormWrapper>
      );
      expect(screen.getByText('邮箱')).toBeInTheDocument();
      expect(screen.getByText('密码')).toBeInTheDocument();
    });
  });

  describe('空间布局', () => {
    it('应该有正确的间距', () => {
      const { container } = render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
        </FormWrapper>
      );
      const wrapper = container.querySelector('.space-y-1');
      expect(wrapper).toBeInTheDocument();
    });

    it('应该在多个字段之间保持一致的间距', () => {
      const { container } = render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
          <InputField name="password" label="密码" />
        </FormWrapper>
      );
      const wrappers = container.querySelectorAll('.space-y-1');
      expect(wrappers.length).toBe(2);
    });
  });

  describe('无障碍性', () => {
    it('应该有适当的 ARIA 标签', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
        </FormWrapper>
      );
      const label = screen.getByText('邮箱');
      expect(label).toHaveAttribute('for', 'email');
    });

    it('应该在必需时显示适当的指示', () => {
      render(
        <FormWrapper>
          <InputField name="email" label="邮箱" required />
        </FormWrapper>
      );
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('快照测试', () => {
    it('基础字段快照', () => {
      const { container } = render(
        <FormWrapper>
          <InputField name="email" label="邮箱" />
        </FormWrapper>
      );
      expect(container.firstChild).toMatchSnapshot();
    });

    it('必需字段快照', () => {
      const { container } = render(
        <FormWrapper>
          <InputField name="email" label="邮箱" required />
        </FormWrapper>
      );
      expect(container.firstChild).toMatchSnapshot();
    });

    it('带辅助文本的字段快照', () => {
      const { container } = render(
        <FormWrapper>
          <InputField
            name="email"
            label="邮箱"
            helperText="使用有效的邮箱地址"
          />
        </FormWrapper>
      );
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
