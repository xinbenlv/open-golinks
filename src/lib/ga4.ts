import { randomBytes } from "node:crypto";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

export type StatsDay = {
  date: string;
  eventCount: number;
  activeUsers: number;
};

export type StatsSummary = {
  totalClicks: number;
  days: StatsDay[];
  source: "ga4";
  scope: { slugCount: number };
};

type ReportRedirectInput = {
  clientId: string;
  slug: string;
  userAgent?: string | null;
  referer?: string | null;
};

type StatsProvider = (slugs: string[], days: number) => Promise<StatsSummary>;

let client: BetaAnalyticsDataClient | null = null;
let statsProviderForTests: StatsProvider | null = null;

export function setStatsSummaryProviderForTests(provider: StatsProvider | null) {
  statsProviderForTests = provider;
}

export function newGaClientId() {
  return randomBytes(16).toString("hex");
}

function baseUrl() {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.VITE_BASE_URL ||
    "https://open-golinks-v2-hono-production.up.railway.app"
  ).replace(/\/$/, "");
}

function ga4Client() {
  if (!client) client = new BetaAnalyticsDataClient();
  return client;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function blankDays(days: number): StatsDay[] {
  const out: StatsDay[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push({ date: dayKey(d), eventCount: 0, activeUsers: 0 });
  }
  return out;
}

function gaDateToIso(value: string) {
  if (!/^\d{8}$/.test(value)) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export async function reportRedirectToGA4(input: ReportRedirectInput) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  const pagePath = `/${input.slug}`;
  const body = {
    client_id: input.clientId,
    events: [
      {
        name: "page_view",
        params: {
          page_location: `${baseUrl()}${pagePath}`,
          page_path: pagePath,
          page_title: pagePath,
          slug: input.slug,
          source: "v2-hono",
          is_redirect: true,
          user_agent: input.userAgent ?? undefined,
          referer: input.referer ?? undefined,
        },
      },
    ],
  };

  const url =
    `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}` +
    `&api_secret=${apiSecret}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GA4 Measurement Protocol failed: ${res.status}`);
  }
}

export async function getStatsSummaryForSlugs(
  slugs: string[],
  days: number,
): Promise<StatsSummary> {
  if (statsProviderForTests) return statsProviderForTests(slugs, days);
  const normalizedDays = Math.max(1, Math.min(days, 90));
  const series = blankDays(normalizedDays);
  if (!slugs.length) {
    return {
      totalClicks: 0,
      days: series,
      source: "ga4",
      scope: { slugCount: 0 },
    };
  }

  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) throw new Error("GA4_PROPERTY_ID is not configured");

  const pathRegex = `^/(${slugs.map(escapeRegex).join("|")})$`;
  const [response] = await ga4Client().runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${normalizedDays - 1}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "eventCount" }, { name: "activeUsers" }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: "eventName",
              stringFilter: { matchType: "EXACT", value: "page_view" },
            },
          },
          {
            filter: {
              fieldName: "pagePath",
              stringFilter: { matchType: "PARTIAL_REGEXP", value: pathRegex },
            },
          },
        ],
      },
    },
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });

  const byDate = new Map(series.map((day) => [day.date, day]));
  for (const row of response.rows ?? []) {
    const date = gaDateToIso(row.dimensionValues?.[0]?.value ?? "");
    const current = byDate.get(date);
    if (!current) continue;
    current.eventCount = Number(row.metricValues?.[0]?.value ?? 0);
    current.activeUsers = Number(row.metricValues?.[1]?.value ?? 0);
  }

  return {
    totalClicks: series.reduce((sum, day) => sum + day.eventCount, 0),
    days: series,
    source: "ga4",
    scope: { slugCount: slugs.length },
  };
}
