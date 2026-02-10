/**
 * 数据格式化工具函数 - 用于分析组件的数据处理
 */

/**
 * 格式化访问量为可读格式
 * 1000 => "1K", 1500 => "1.5K", 1000000 => "1M"
 */
export function formatVisits(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

/**
 * 计算趋势百分比
 * 正数表示增长，负数表示下降
 */
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * 格式化日期为简化格式
 * 2024-01-15 => "Jan 15"
 */
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * 格式化日期为完整格式
 * 2024-01-15 => "January 15, 2024"
 */
export function formatDateLong(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * 获取指定天数范围的日期数组
 * 用于填充缺失的日期数据
 */
export function getDateRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dates.push(dateStr);
  }

  return dates;
}

/**
 * 填充缺失的日期数据
 * 将稀疏的数据点填充为连续的日期序列，缺失日期的访问量为0
 */
export function fillMissingDates(
  data: Array<{ date: string; count: number }>,
  days: number
): Array<{ date: string; count: number }> {
  const dateRange = getDateRange(days);
  const dataMap = new Map(data.map(d => [d.date, d.count]));

  return dateRange.map(date => ({
    date,
    count: dataMap.get(date) || 0,
  }));
}

/**
 * 计算统计汇总
 */
export function calculateStats(
  data: Array<{ count: number }>
): {
  total: number;
  average: number;
  max: number;
  min: number;
} {
  if (data.length === 0) {
    return { total: 0, average: 0, max: 0, min: 0 };
  }

  const counts = data.map(d => d.count);
  const total = counts.reduce((sum, c) => sum + c, 0);
  const average = Math.round(total / counts.length);
  const max = Math.max(...counts);
  const min = Math.min(...counts);

  return { total, average, max, min };
}

/**
 * 导出数据为 CSV 格式
 */
export function exportToCSV(
  data: Array<{ date: string; count: number }>,
  filename: string = 'analytics.csv'
): void {
  const csv = [
    ['Date', 'Visits'],
    ...data.map(d => [d.date, d.count]),
  ]
    .map(row => row.join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * 将访问量数据分组为指定间隔（用于降采样）
 * 例如：每周一组，每月一组
 */
export function groupByInterval(
  data: Array<{ date: string; count: number }>,
  intervalDays: number
): Array<{ date: string; count: number }> {
  if (data.length === 0) return [];

  const grouped: Map<string, number> = new Map();

  data.forEach(({ date, count }) => {
    const d = new Date(date);
    d.setDate(d.getDate() - (d.getDay()));
    const weekStart = d.toISOString().split('T')[0];

    grouped.set(weekStart, (grouped.get(weekStart) || 0) + count);
  });

  return Array.from(grouped.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
