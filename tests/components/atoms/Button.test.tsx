import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/atoms/Button';

/**
 * Button 组件测试套件
 * 测试范围：
 * - 渲染和样式变体
 * - 尺寸变体
 * - 交互事件
 * - 禁用和加载状态
 * - 可访问性
 * - 快照测试
 */

describe('Button 组件', () => {
  describe('基础渲染', () => {
    it('应该渲染按钮文本', () => {
      render(<Button>点击我</Button>);
      expect(screen.getByRole('button', { name: '点击我' })).toBeInTheDocument();
    });

    it('应该使用正确的标签元素', () => {
      render(<Button>按钮</Button>);
      expect(screen.getByRole('button')).toBeInstanceOf(HTMLButtonElement);
    });

    it('应该支持自定义类名', () => {
      render(<Button className="custom-class">按钮</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });

  describe('变体', () => {
    it('应该渲染主要变体 (primary)', () => {
      const { container } = render(
        <Button variant="primary">主按钮</Button>
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-primary');
    });

    it('应该渲染次要变体 (secondary)', () => {
      const { container } = render(
        <Button variant="secondary">次按钮</Button>
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-gray-200');
    });

    it('应该渲染幽灵变体 (ghost)', () => {
      const { container } = render(
        <Button variant="ghost">幽灵按钮</Button>
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('text-primary');
    });

    it('应该渲染危险变体 (danger)', () => {
      const { container } = render(
        <Button variant="danger">删除</Button>
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-error');
    });

    it('应该默认使用主要变体 (primary)', () => {
      const { container } = render(<Button>默认按钮</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-primary');
    });
  });

  describe('尺寸', () => {
    it('应该渲染小尺寸 (sm)', () => {
      const { container } = render(
        <Button size="sm">小按钮</Button>
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm');
    });

    it('应该渲染中等尺寸 (md)', () => {
      const { container } = render(
        <Button size="md">中按钮</Button>
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('px-4', 'py-2', 'text-base');
    });

    it('应该渲染大尺寸 (lg)', () => {
      const { container } = render(
        <Button size="lg">大按钮</Button>
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('px-6', 'py-3', 'text-lg');
    });

    it('应该默认使用中等尺寸 (md)', () => {
      const { container } = render(<Button>默认尺寸</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('px-4', 'py-2');
    });
  });

  describe('加载状态', () => {
    it('应该在加载时显示加载动画', () => {
      const { container } = render(
        <Button isLoading>加载中</Button>
      );
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('应该在加载时禁用按钮', () => {
      render(<Button isLoading>加载中</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('应该在加载时保持文本可见', () => {
      render(<Button isLoading>加载中</Button>);
      expect(screen.getByText('加载中')).toBeInTheDocument();
    });

    it('应该在加载时添加不透明度类', () => {
      const { container } = render(
        <Button isLoading>加载中</Button>
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('disabled:opacity-50');
    });
  });

  describe('禁用状态', () => {
    it('应该在 disabled 为 true 时禁用按钮', () => {
      render(<Button disabled>禁用按钮</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('应该在加载和禁用时正确处理', () => {
      render(
        <Button isLoading disabled>
          加载中
        </Button>
      );
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('应该显示禁用样式', () => {
      const { container } = render(<Button disabled>禁用</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });
  });

  describe('事件处理', () => {
    it('应该在点击时触发 onClick 回调', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>点击</Button>);

      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledOnce();
    });

    it('应该在禁用状态下不触发 onClick', async () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>禁用</Button>);

      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('应该在加载状态下不触发 onClick', async () => {
      const handleClick = vi.fn();
      render(<Button isLoading onClick={handleClick}>加载中</Button>);

      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('应该支持多次点击', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>点击</Button>);

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('应该支持键盘触发 (Enter)', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>按钮</Button>);

      const button = screen.getByRole('button');
      button.focus();
      await userEvent.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalled();
    });

    it('应该支持 type 属性', () => {
      render(<Button type="submit">提交</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });
  });

  describe('图标支持', () => {
    it('应该在文本前显示图标', () => {
      render(
        <Button icon="📝">
          创建
        </Button>
      );
      expect(screen.getByText('📝')).toBeInTheDocument();
      expect(screen.getByText('创建')).toBeInTheDocument();
    });

    it('应该在图标后添加间距', () => {
      const { container } = render(
        <Button icon="✓">
          确认
        </Button>
      );
      const iconSpan = container.querySelector('.mr-2:not(.animate-spin)');
      expect(iconSpan).toBeInTheDocument();
    });

    it('应该支持 React 元素作为图标', () => {
      render(
        <Button icon={<span data-testid="custom-icon">🔄</span>}>
          刷新
        </Button>
      );
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('可访问性', () => {
    it('应该有正确的角色', () => {
      render(<Button>按钮</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('应该在禁用时有正确的 aria 属性', () => {
      render(<Button disabled>禁用</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('disabled');
    });

    it('应该支持 aria-label', () => {
      render(<Button aria-label="关闭对话框">×</Button>);
      expect(screen.getByRole('button', { name: '关闭对话框' })).toBeInTheDocument();
    });

    it('应该支持 aria-disabled', () => {
      render(<Button disabled>按钮</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('disabled');
    });

    it('应该有正确的焦点样式', () => {
      const { container } = render(<Button>按钮</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('focus-visible:outline-2');
    });

    it('应该有足够的按钮尺寸用于触摸', () => {
      const { container } = render(<Button>按钮</Button>);
      const button = container.querySelector('button');
      const styles = window.getComputedStyle(button!);
      // 检查最小触摸尺寸（44x44px）
      expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center');
    });
  });

  describe('组合功能', () => {
    it('应该支持变体、尺寸和状态的组合', () => {
      const { container } = render(
        <Button variant="danger" size="lg" disabled>
          删除账户
        </Button>
      );
      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-error', 'px-6', 'py-3', 'text-lg');
      expect(button).toBeDisabled();
    });

    it('应该支持图标、加载和文本的组合', () => {
      render(
        <Button isLoading icon="⭐">
          保存
        </Button>
      );
      expect(screen.getByText('⭐')).toBeInTheDocument();
      expect(screen.getByText('保存')).toBeInTheDocument();
    });
  });

  describe('快照测试', () => {
    it('primary 按钮快照', () => {
      const { container } = render(
        <Button variant="primary" size="md">
          主按钮
        </Button>
      );
      expect(container.firstChild).toMatchSnapshot();
    });

    it('加载状态按钮快照', () => {
      const { container } = render(
        <Button isLoading>加载中</Button>
      );
      expect(container.firstChild).toMatchSnapshot();
    });

    it('禁用状态按钮快照', () => {
      const { container } = render(
        <Button disabled>禁用</Button>
      );
      expect(container.firstChild).toMatchSnapshot();
    });

    it('带图标按钮快照', () => {
      const { container } = render(
        <Button icon="✓">确认</Button>
      );
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('ref 转发', () => {
    it('应该正确转发 ref', () => {
      const ref = vi.fn();
      render(<Button ref={ref}>按钮</Button>);
      expect(ref).toHaveBeenCalled();
    });

    it('应该允许通过 ref 访问按钮元素', () => {
      let buttonRef: HTMLButtonElement | null = null;
      render(<Button ref={(el) => { buttonRef = el; }}>按钮</Button>);
      expect(buttonRef).toBeInstanceOf(HTMLButtonElement);
      expect(buttonRef?.textContent).toBe('按钮');
    });
  });

  describe('其他 HTML 属性', () => {
    it('应该支持自定义数据属性', () => {
      render(<Button data-testid="custom-btn">按钮</Button>);
      expect(screen.getByTestId('custom-btn')).toBeInTheDocument();
    });

    it('应该支持 name 属性', () => {
      render(<Button name="action">按钮</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('name', 'action');
    });

    it('应该支持 value 属性', () => {
      render(<Button value="delete">按钮</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('value', 'delete');
    });
  });
});
