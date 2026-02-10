import React from 'react';
import { Card } from '@/components/atoms/Card';
import { Badge } from '@/components/atoms/Badge';
import { cn } from '@/lib/cn';

interface StatCardProps {
  /**
   * 统计数据标题
   */
  label: string;

  /**
   * 主显示值
   */
  value: string | number;

  /**
   * 可选的趋势指标
   * 正数表示增长（显示为绿色），负数表示下降（显示为红色）
   */
  trend?: number;

  /**
   * 趋势百分比文本（默认自动计算）
   */
  trendLabel?: string;

  /**
   * 副文本或描述
   */
  subtitle?: string;

  /**
   * 卡片背景颜色变体
   * primary (blue), success (green), warning (orange), error (red), default (gray)
   */
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'default';

  /**
   * 图标 JSX 元素
   */
  icon?: React.ReactNode;

  /**
   * 是否显示加载状态
   */
  isLoading?: boolean;

  /**
   * 额外 CSS 类名
   */
  className?: string;
}

/**
 * StatCard - 统计卡片分子组件
 *
 * 用途：显示单个统计指标，包括值、趋势、图标等
 *
 * 使用示例：
 * ```tsx
 * <StatCard
 *   label="Total Visits"
 *   value={1250}
 *   trend={25}
 *   icon={<VisitIcon />}
 * />
 *
 * <StatCard
 *   label="Average"
 *   value="42.5"
 *   trend={-5}
 *   variant="warning"
 * />
 * ```
 */
export function StatCard({
  label,
  value,
  trend,
  trendLabel,
  subtitle,
  variant = 'default',
  icon,
  isLoading = false,
  className,
}: StatCardProps): React.ReactElement {
  const getTrendVariant = (): 'success' | 'error' | 'gray' => {
    if (trend === undefined) return 'gray';
    return trend >= 0 ? 'success' : 'error';
  };

  const getTrendText = (): string => {
    if (trendLabel) return trendLabel;
    if (trend === undefined) return '';

    const arrow = trend >= 0 ? '↑' : '↓';
    return `${arrow} ${Math.abs(trend)}%`;
  };

  const backgroundColor = {
    primary: 'bg-blue-50',
    success: 'bg-green-50',
    warning: 'bg-orange-50',
    error: 'bg-red-50',
    default: 'bg-white',
  }[variant];

  const borderColor = {
    primary: 'border-blue-200',
    success: 'border-green-200',
    warning: 'border-orange-200',
    error: 'border-red-200',
    default: 'border-gray-200',
  }[variant];

  return (
    <Card
      className={cn(
        `${backgroundColor} ${borderColor} border relative overflow-hidden transition-all hover:shadow-lg`,
        className
      )}
      interactive
    >
      {/* 背景装饰 */}
      <div
        className={`absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-10 ${
          variant === 'primary'
            ? 'bg-blue-400'
            : variant === 'success'
              ? 'bg-green-400'
              : variant === 'warning'
                ? 'bg-orange-400'
                : variant === 'error'
                  ? 'bg-red-400'
                  : 'bg-gray-400'
        }`}
      />

      <div className="flex items-start justify-between mb-4">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        {trend !== undefined && (
          <Badge variant={getTrendVariant()} className="ml-auto text-xs">
            {getTrendText()}
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm text-gray-600 font-medium">{label}</p>

        {isLoading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-20" />
          </div>
        ) : (
          <>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
          </>
        )}
      </div>

      {/* 无障碍 - 屏幕阅读器文本 */}
      <div className="sr-only">
        {label}: {value}
        {trend !== undefined && `, trend: ${getTrendText()}`}
      </div>
    </Card>
  );
}
