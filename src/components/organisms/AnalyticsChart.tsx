'use client';

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Spinner } from '@/components/atoms/Spinner';
import {
  formatDateShort,
  fillMissingDates,
  calculateStats,
  exportToCSV,
} from '@/lib/utils/analytics';
import { cn } from '@/lib/cn';

interface AnalyticsChartProps {
  /**
   * 图表标题
   */
  title?: string;

  /**
   * 原始数据：日访问统计
   */
  data: Array<{ date: string; count: number }>;

  /**
   * 是否显示加载状态
   */
  isLoading?: boolean;

  /**
   * 是否显示错误状态
   */
  error?: string | null;

  /**
   * 是否可导出数据
   */
  exportable?: boolean;

  /**
   * 是否显示图例
   */
  showLegend?: boolean;

  /**
   * 图表高度（像素）
   */
  height?: number;

  /**
   * 额外 CSS 类名
   */
  className?: string;
}

/**
 * 自定义 Tooltip 组件
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; date: string }>;
}): React.ReactElement | null {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0];

  return (
    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
      <p className="text-xs font-semibold text-gray-700">{data.date}</p>
      <p className="text-sm font-bold text-blue-600 mt-1">{data.value} visits</p>
    </div>
  );
}

/**
 * AnalyticsChart - 分析图表生物组件
 *
 * 用途：显示时间序列的访问统计，支持日期范围选择、数据导出等
 *
 * 特性：
 * - 响应式设计，自适应容器宽度
 * - 支持 7/30/90 天范围选择
 * - 数据自动填充缺失日期
 * - 计算并显示平均值、最大值参考线
 * - 支持数据导出为 CSV
 * - 完整的无障碍支持
 *
 * 使用示例：
 * ```tsx
 * const data = [
 *   { date: '2024-01-01', count: 42 },
 *   { date: '2024-01-02', count: 58 },
 * ];
 *
 * <AnalyticsChart
 *   title="Daily Visits"
 *   data={data}
 *   exportable
 * />
 * ```
 */
export function AnalyticsChart({
  title = 'Daily Visits',
  data,
  isLoading = false,
  error = null,
  exportable = true,
  showLegend = true,
  height = 400,
  className,
}: AnalyticsChartProps): React.ReactElement {
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30);

  // 处理数据：填充缺失日期、排序
  const processedData = useMemo(() => {
    const filled = fillMissingDates(data, dateRange);
    return filled.map(d => ({
      ...d,
      date: formatDateShort(d.date),
      fullDate: d.date, // 保持原始日期用于导出
    }));
  }, [data, dateRange]);

  // 计算统计数据
  const stats = useMemo(() => calculateStats(processedData), [processedData]);

  const handleExport = () => {
    const csvData = processedData.map(d => ({
      date: d.fullDate,
      count: d.count,
    }));
    exportToCSV(csvData, `analytics-${dateRange}days.csv`);
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <div className="text-center py-8">
          <p className="text-red-800 font-semibold">Failed to load analytics</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('space-y-6', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Last {dateRange} days ({stats.total} visits)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 日期范围选择 */}
          <div className="flex gap-2" role="group" aria-label="Date range selector">
            {[7, 30, 90].map(range => (
              <Button
                key={range}
                variant={dateRange === range ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setDateRange(range as 7 | 30 | 90)}
                aria-pressed={dateRange === range}
              >
                {range}d
              </Button>
            ))}
          </div>

          {/* 导出按钮 */}
          {exportable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              disabled={isLoading}
              aria-label="Export analytics data as CSV"
            >
              {isLoading ? <Spinner size="sm" /> : 'Export'}
            </Button>
          )}
        </div>
      </div>

      {/* 统计摘要 */}
      <div className="grid grid-cols-3 gap-4 text-center text-sm">
        <div className="p-3 bg-blue-50 rounded">
          <p className="text-gray-600">Average</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{stats.average}</p>
        </div>
        <div className="p-3 bg-green-50 rounded">
          <p className="text-gray-600">Peak</p>
          <p className="text-lg font-bold text-green-600 mt-1">{stats.max}</p>
        </div>
        <div className="p-3 bg-orange-50 rounded">
          <p className="text-gray-600">Total</p>
          <p className="text-lg font-bold text-orange-600 mt-1">{stats.total}</p>
        </div>
      </div>

      {/* 图表 */}
      {isLoading ? (
        <div className="flex items-center justify-center" style={{ height }}>
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="w-full" role="img" aria-label={`Line chart showing ${title}`}>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={processedData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                stroke="#8b8b8b"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="#8b8b8b"
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* 平均值参考线 */}
              {stats.average > 0 && (
                <ReferenceLine
                  y={stats.average}
                  stroke="#8b5cf6"
                  strokeDasharray="5 5"
                  label={{
                    value: `Avg: ${stats.average}`,
                    position: 'right',
                    fill: '#8b5cf6',
                    fontSize: 12,
                  }}
                />
              )}

              {/* 最大值参考线 */}
              {stats.max > 0 && (
                <ReferenceLine
                  y={stats.max}
                  stroke="#10b981"
                  strokeDasharray="5 5"
                  label={{
                    value: `Peak: ${stats.max}`,
                    position: 'right',
                    fill: '#10b981',
                    fontSize: 12,
                  }}
                />
              )}

              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6, fill: '#2563eb' }}
                name="Visits"
                isAnimationActive={true}
              />

              {showLegend && <Legend />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 数据空状态 */}
      {!isLoading && processedData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No data available for the selected period</p>
        </div>
      )}

      {/* 无障碍 - 数据表格视图 */}
      <details className="sr-only">
        <summary>Analytics Data Table</summary>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Visits</th>
            </tr>
          </thead>
          <tbody>
            {processedData.map(d => (
              <tr key={d.fullDate}>
                <td>{d.fullDate}</td>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}
