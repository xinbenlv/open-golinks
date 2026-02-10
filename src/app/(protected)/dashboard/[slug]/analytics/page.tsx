
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { db } from '@/db/db';
import { linksTable, dailyVisitsTable } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { AnalyticsChart } from '@/components/organisms/AnalyticsChart';
import { StatCard } from '@/components/molecules/StatCard';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import Link from 'next/link';
import { formatDateLong, calculateTrend } from '@/lib/utils/analytics';

interface LinkAnalyticsPageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({
  params,
}: LinkAnalyticsPageProps): Promise<Metadata> {
  return {
    title: `Analytics: ${params.slug} | Open GoLinks`,
    description: `View analytics and statistics for your short link: ${params.slug}`,
  };
}

export default async function LinkAnalyticsPage({
  params,
}: LinkAnalyticsPageProps) {
  // 身份验证检查
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  // 获取链接及验证所有权
  const link = await db.query.linksTable.findFirst({
    where: eq(linksTable.slug, params.slug),
  });

  if (!link) {
    notFound();
  }

  // 仅允许链接所有者查看分析
  if (link.ownerId !== user.id) {
    redirect('/dashboard');
  }

  // 获取过去 90 天的日访问统计
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const dailyVisits = await db
    .select()
    .from(dailyVisitsTable)
    .where(
      and(
        eq(dailyVisitsTable.linkSlug, params.slug),
        gte(dailyVisitsTable.date, ninetyDaysAgo)
      )
    )
    .orderBy(dailyVisitsTable.date);

  // 获取过去 30 天的日访问统计（用于趋势计算）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const last30Days = dailyVisits.filter(d => d.date >= thirtyDaysAgo);
  const last7Days = dailyVisits.filter(d => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return d.date >= sevenDaysAgo;
  });

  // 计算统计数据
  const totalVisits = link.visits || 0;
  const visits30Days = last30Days.reduce((sum, d) => sum + d.count, 0);
  const visits7Days = last7Days.reduce((sum, d) => sum + d.count, 0);
  const visits30DaysAverage = last30Days.length > 0 ? Math.round(visits30Days / 30) : 0;

  // 计算趋势（最近7天 vs 之前7天）
  const previousPeriodStart = new Date();
  previousPeriodStart.setDate(previousPeriodStart.getDate() - 14);
  const previousPeriodEnd = new Date();
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 7);

  const previous7Days = dailyVisits.filter(d => d.date >= previousPeriodStart && d.date < previousPeriodEnd);
  const previous7DaysTotal = previous7Days.reduce((sum, d) => sum + d.count, 0);
  const trendPercent = calculateTrend(visits7Days, previous7DaysTotal);

  // 准备图表数据
  const chartData = dailyVisits.map(d => {
    let dateStr: string;
    if (d.date instanceof Date) {
      dateStr = d.date.toISOString().split('T')[0] || '';
    } else if (typeof d.date === 'string') {
      dateStr = d.date;
    } else {
      dateStr = new Date(d.date).toISOString().split('T')[0] || '';
    }
    return {
      date: dateStr,
      count: d.count,
    };
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const fullUrl = `${baseUrl}/${params.slug}`;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面头部 */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{params.slug}</h1>
              <p className="text-gray-600 mt-1">Analytics & Statistics</p>
            </div>
            <Link href={`/dashboard`}>
              <Button variant="ghost">← Back to Dashboard</Button>
            </Link>
          </div>

          {/* 链接信息卡片 */}
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-gray-600">Short Link</p>
                <p className="text-lg font-mono font-semibold text-blue-600 mt-1">{fullUrl}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {formatDateLong(link.createdAt.toISOString())}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* 统计卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Visits"
            value={totalVisits}
            trend={trendPercent}
            variant="primary"
            subtitle={`All time`}
          />

          <StatCard
            label="Last 30 Days"
            value={visits30Days}
            variant="success"
            subtitle={`${visits30DaysAverage} per day`}
          />

          <StatCard
            label="Last 7 Days"
            value={visits7Days}
            trend={trendPercent}
            variant={trendPercent >= 0 ? 'success' : 'warning'}
            subtitle={`${trendPercent >= 0 ? '+' : ''}${trendPercent}% vs previous week`}
          />

          <StatCard
            label="Peak Day"
            value={Math.max(...dailyVisits.map(d => d.count), 0)}
            variant="warning"
            subtitle={`In the past 90 days`}
          />
        </div>

        {/* 分析图表 */}
        <div className="mb-8">
          <AnalyticsChart
            title="Daily Visits Over Time"
            data={chartData}
            exportable
            showLegend
            height={400}
          />
        </div>

        {/* 额外信息卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 原始链接 */}
          <Card>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Target URL</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Destination</p>
              <p className="text-sm font-mono bg-gray-100 p-3 rounded break-all text-gray-900">
                {link.url}
              </p>
            </div>
          </Card>

          {/* 链接状态 */}
          <Card>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Link Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className="text-sm font-semibold text-green-600">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Visibility</span>
                <span className="text-sm font-semibold text-gray-900">
                  {link.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Owner</span>
                <span className="text-sm font-semibold text-gray-900">You</span>
              </div>
            </div>
          </Card>
        </div>

        {/* 导航 */}
        <div className="mt-8 flex gap-3">
          <Link href={`/dashboard`}>
            <Button variant="ghost">← Back to Dashboard</Button>
          </Link>
          <Link href={`/dashboard/${params.slug}/edit`}>
            <Button variant="secondary">Edit Link</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
