import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/atoms/Input';

/**
 * Input 组件测试套件
 * 测试范围：
 * - 基础渲染和输入
 * - 不同类型的输入框
 * - 错误和加载状态
 * - 事件处理
 * - 可访问性
 * - 快照测试
 */

describe('Input 组件', () => {
  describe('基础渲染', () => {
    it('应该渲染输入框', () => {
      render(<Input type="text" />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('应该使用正确的元素标签', () => {
      render(<Input type="text" />);
      expect(screen.getByRole('textbox')).toBeInstanceOf(HTMLInputElement);
    });

    it('应该支持占位符', () => {
      render(<Input placeholder="输入内容..." />);
      expect(screen.getByPlaceholderText('输入内容...')).toBeInTheDocument();
    });

    it('应该支持默认值', () => {
      render(<Input defaultValue="默认值" />);
      expect(screen.getByDisplayValue('默认值')).toBeInTheDocument();
    });

    it('应该支持自定义类名', () => {
      render(<Input className="custom-class" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('custom-class');
    });
  });

  describe('输入类型', () => {
    it('应该支持 text 类型', () => {
      render(<Input type="text" data-testid="text-input" />);
      expect(screen.getByTestId('text-input')).toHaveAttribute('type', 'text');
    });

    it('应该支持 email 类型', () => {
      render(<Input type="email" data-testid="email-input" />);
      expect(screen.getByTestId('email-input')).toHaveAttribute('type', 'email');
    });

    it('应该支持 password 类型', () => {
      render(<Input type="password" data-testid="password-input" />);
      expect(screen.getByTestId('password-input')).toHaveAttribute('type', 'password');
    });

    it('应该支持 number 类型', () => {
      render(<Input type="number" data-testid="number-input" />);
      expect(screen.getByTestId('number-input')).toHaveAttribute('type', 'number');
    });

    it('应该支持 url 类型', () => {
      render(<Input type="url" data-testid="url-input" />);
      expect(screen.getByTestId('url-input')).toHaveAttribute('type', 'url');
    });

    it('应该支持 search 类型', () => {
      render(<Input type="search" data-testid="search-input" />);
      expect(screen.getByTestId('search-input')).toHaveAttribute('type', 'search');
    });
  });

  describe('错误状态', () => {
    it('应该接受 error 属性', () => {
      const { container } = render(<Input error="错误信息" data-testid="input" />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('border-error');
    });

    it('应该在有错误时应用错误样式', () => {
      const { container } = render(
        <Input error="邮箱格式不正确" data-testid="input" />
      );
      const input = container.querySelector('input');
      expect(input).toHaveClass('border-error', 'focus:ring-error');
    });

    it('应该在没有错误时不应用错误样式', () => {
      const { container } = render(<Input error="" data-testid="input" />);
      const input = container.querySelector('input');
      expect(input).not.toHaveClass('border-error');
    });
  });

  describe('禁用状态', () => {
    it('应该支持 disabled 属性', () => {
      render(<Input disabled data-testid="input" />);
      expect(screen.getByTestId('input')).toBeDisabled();
    });

    it('应该在禁用时显示禁用样式', () => {
      const { container } = render(<Input disabled data-testid="input" />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('disabled:bg-gray-100', 'disabled:cursor-not-allowed');
    });

    it('应该在禁用时不允许输入', async () => {
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;

      await userEvent.type(input, 'text');
      expect(input.value).toBe('');
    });
  });

  describe('事件处理', () => {
    it('应该在输入时触发 onChange 事件', async () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} data-testid="input" />);

      await userEvent.type(screen.getByTestId('input'), 'test');
      expect(handleChange).toHaveBeenCalled();
    });

    it('应该在获得焦点时触发 onFocus 事件', async () => {
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} data-testid="input" />);

      await userEvent.click(screen.getByTestId('input'));
      expect(handleFocus).toHaveBeenCalled();
    });

    it('应该在失去焦点时触发 onBlur 事件', async () => {
      const handleBlur = vi.fn();
      render(
        <>
          <Input onBlur={handleBlur} data-testid="input" />
          <button>其他元素</button>
        </>
      );

      await userEvent.click(screen.getByTestId('input'));
      await userEvent.click(screen.getByText('其他元素'));
      expect(handleBlur).toHaveBeenCalled();
    });

    it('应该在键盘事件时触发 onKeyDown', async () => {
      const handleKeyDown = vi.fn();
      render(<Input onKeyDown={handleKeyDown} data-testid="input" />);

      const input = screen.getByTestId('input');
      await userEvent.type(input, '{Enter}');
      expect(handleKeyDown).toHaveBeenCalled();
    });

    it('应该正确处理输入值变化', async () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;

      await userEvent.type(input, 'hello world');
      expect(input.value).toBe('hello world');
    });

    it('应该支持清空输入框', async () => {
      render(<Input data-testid="input" defaultValue="text" />);
      const input = screen.getByTestId('input') as HTMLInputElement;

      await userEvent.clear(input);
      expect(input.value).toBe('');
    });
  });

  describe('焦点管理', () => {
    it('应该能获得焦点', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');

      input.focus();
      expect(input).toHaveFocus();
    });

    it('应该使用 autoFocus 属性自动获得焦点', () => {
      render(<Input autoFocus data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveFocus();
    });

    it('应该应用焦点样式', () => {
      const { container } = render(<Input data-testid="input" />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-primary');
    });
  });

  describe('外观样式', () => {
    it('应该应用基础样式', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('w-full', 'px-3', 'py-2', 'border', 'border-gray-300', 'rounded-md');
    });

    it('应该应用占位符样式', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('placeholder:text-gray-400');
    });

    it('应该根据错误状态改变样式', () => {
      const { container, rerender } = render(<Input data-testid="input" />);
      let input = container.querySelector('input');
      expect(input).toHaveClass('border-gray-300');

      rerender(<Input data-testid="input" error="error" />);
      input = container.querySelector('input');
      expect(input).toHaveClass('border-error');
    });
  });

  describe('可访问性', () => {
    it('应该有正确的角色', () => {
      render(<Input type="text" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'text');
    });

    it('应该支持 aria-label', () => {
      render(<Input aria-label="搜索框" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('aria-label', '搜索框');
    });

    it('应该支持 aria-labelledby', () => {
      render(
        <>
          <label id="label">用户名</label>
          <Input aria-labelledby="label" data-testid="input" />
        </>
      );
      expect(screen.getByTestId('input')).toHaveAttribute('aria-labelledby', 'label');
    });

    it('应该支持 aria-describedby', () => {
      render(
        <>
          <span id="help">邮箱格式：user@example.com</span>
          <Input aria-describedby="help" data-testid="input" />
        </>
      );
      expect(screen.getByTestId('input')).toHaveAttribute('aria-describedby', 'help');
    });

    it('应该支持 required 属性', () => {
      render(<Input required data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('required');
    });

    it('应该有足够的触摸目标尺寸', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('py-2');
    });
  });

  describe('Ref 转发', () => {
    it('应该正确转发 ref', () => {
      const ref = vi.fn();
      render(<Input ref={ref} />);
      expect(ref).toHaveBeenCalled();
    });

    it('应该允许通过 ref 访问输入元素', () => {
      let inputRef: HTMLInputElement | null = null;
      render(<Input ref={(el) => { inputRef = el; }} />);
      expect(inputRef).toBeInstanceOf(HTMLInputElement);
    });

    it('应该能通过 ref 设置值', () => {
      let inputRef: HTMLInputElement | null = null;
      render(<Input ref={(el) => { inputRef = el; }} />);

      if (inputRef) {
        inputRef.value = 'test value';
        expect(inputRef.value).toBe('test value');
      }
    });
  });

  describe('其他 HTML 属性', () => {
    it('应该支持 name 属性', () => {
      render(<Input name="username" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('name', 'username');
    });

    it('应该支持 id 属性', () => {
      render(<Input id="email-input" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('id', 'email-input');
    });

    it('应该支持 maxLength 属性', () => {
      render(<Input maxLength={10} data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('maxLength', '10');
    });

    it('应该支持 min 和 max（number 输入）', () => {
      render(<Input type="number" min="0" max="100" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '100');
    });

    it('应该支持 pattern 属性', () => {
      render(<Input pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('pattern');
    });

    it('应该支持 step 属性（number 输入）', () => {
      render(<Input type="number" step="0.1" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('step', '0.1');
    });
  });

  describe('快照测试', () => {
    it('默认输入框快照', () => {
      const { container } = render(<Input data-testid="input" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('带错误的输入框快照', () => {
      const { container } = render(<Input error="错误信息" data-testid="input" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('禁用状态输入框快照', () => {
      const { container } = render(<Input disabled data-testid="input" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('email 类型输入框快照', () => {
      const { container } = render(<Input type="email" data-testid="input" />);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
