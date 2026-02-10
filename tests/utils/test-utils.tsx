import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { FormProvider, useForm, DefaultValues } from 'react-hook-form';
import { vi } from 'vitest';

/**
 * 测试工具库
 * 提供常用的测试包装器和辅助函数
 */

/**
 * 表单包装器
 * 为需要 React Hook Form 的组件提供 FormProvider
 */
interface FormWrapperProps {
  children: React.ReactNode;
  defaultValues?: DefaultValues<any>;
  onSubmit?: (data: any) => void;
}

export const FormWrapper = ({
  children,
  defaultValues = {},
  onSubmit = () => {},
}: FormWrapperProps) => {
  const methods = useForm({ defaultValues, mode: 'onBlur' });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {children}
      </form>
    </FormProvider>
  );
};

/**
 * 自定义 render 函数，自动包装 FormProvider
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withForm?: boolean;
  formDefaultValues?: DefaultValues<any>;
  onSubmit?: (data: any) => void;
}

export const renderWithForm = (
  ui: ReactElement,
  {
    withForm = true,
    formDefaultValues = {},
    onSubmit = () => {},
    ...renderOptions
  }: CustomRenderOptions = {}
) => {
  if (!withForm) {
    return render(ui, renderOptions);
  }

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FormWrapper
      defaultValues={formDefaultValues}
      onSubmit={onSubmit}
    >
      {children}
    </FormWrapper>
  );

  return render(ui, { wrapper, ...renderOptions });
};

/**
 * 获取表单字段值的助手
 */
export const getFormValue = (form: any, fieldName: string) => {
  return form.getValues(fieldName);
};

/**
 * 设置表单字段值的助手
 */
export const setFormValue = (form: any, fieldName: string, value: any) => {
  form.setValue(fieldName, value);
};

/**
 * 触发表单验证的助手
 */
export const triggerFormValidation = async (form: any, fieldName: string) => {
  return form.trigger(fieldName);
};

/**
 * 模拟异步操作的辅助函数
 */
export const waitForAsync = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};

/**
 * 创建模拟的 IntersectionObserver
 */
export const setupIntersectionObserverMock = () => {
  const mockIntersectionObserver = vi.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.IntersectionObserver = mockIntersectionObserver as any;
};

/**
 * 创建模拟的 ResizeObserver
 */
export const setupResizeObserverMock = () => {
  const mockResizeObserver = vi.fn();
  mockResizeObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.ResizeObserver = mockResizeObserver as any;
};

/**
 * 测试数据生成器
 */
export const generateTestData = {
  /**
   * 生成测试用户数据
   */
  user: (overrides = {}) => ({
    id: '1',
    email: 'test@example.com',
    username: 'testuser',
    ...overrides,
  }),

  /**
   * 生成测试链接数据
   */
  link: (overrides = {}) => ({
    id: '1',
    shortCode: 'abc123',
    originalUrl: 'https://example.com/very-long-url',
    title: '示例链接',
    createdAt: new Date().toISOString(),
    ...overrides,
  }),

  /**
   * 生成测试表单数据
   */
  formData: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'password123',
    username: 'testuser',
    ...overrides,
  }),
};

/**
 * 可访问性测试辅助函数
 */
export const a11yHelpers = {
  /**
   * 检查元素是否有足够的颜色对比度
   */
  hasGoodContrast: (element: HTMLElement): boolean => {
    // 这是一个简化的检查
    const styles = window.getComputedStyle(element);
    return !!styles.color && !!styles.backgroundColor;
  },

  /**
   * 检查按钮是否有足够的触摸目标
   */
  hasMinimumTouchTarget: (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44;
  },

  /**
   * 检查表单字段是否正确标记
   */
  isProperlyLabeled: (input: HTMLInputElement): boolean => {
    const id = input.id;
    if (!id) return false;

    const label = document.querySelector(`label[for="${id}"]`);
    return !!label;
  },

  /**
   * 检查元素是否键盘可访问
   */
  isKeyboardAccessible: (element: HTMLElement): boolean => {
    return (
      element.tagName === 'BUTTON' ||
      element.tagName === 'A' ||
      element.getAttribute('role') === 'button' ||
      element.getAttribute('tabindex') !== null
    );
  },
};

/**
 * 组件快照测试辅助函数
 */
export const snapshotHelpers = {
  /**
   * 规范化快照（移除动态数据）
   */
  normalizeSnapshot: (html: string): string => {
    return html
      .replace(/id="[^"]*"/g, 'id="normalized-id"')
      .replace(/data-testid="[^"]*"/g, 'data-testid="normalized-id"')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, 'NORMALIZED-DATE');
  },
};

export { render, screen, fireEvent, waitFor } from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';
