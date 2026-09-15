/** 可选本地 GeoLite2/GeoIP2 City 数据库，不把访客 IP 发给第三方。 */
import { open, type CityResponse } from "maxmind";
import type { BrowserSubmissionMetadata } from "./types";
const path = process.env.PROPOSAL_GEOIP_DB;
const reader = path
  ? open<CityResponse>(path).catch(() => {
      console.warn(
        "[proposals] GeoIP database unavailable; location will be unknown",
      );
      return null;
    })
  : Promise.resolve(null);
export async function locate(
  ip: string,
): Promise<BrowserSubmissionMetadata["location"]> {
  if (ip === "Unknown") return null;
  const record = (await reader)?.get(ip);
  if (!record) return null;
  const latitude = record.location?.latitude;
  const longitude = record?.location?.longitude;
  if (latitude === undefined || longitude === undefined) return null;
  const label = [
    record.city?.names.en,
    record.subdivisions?.[0]?.names.en,
    record.country?.names.en,
  ]
    .filter(Boolean)
    .join(", ");
  if (!label) return null;
  return {
    label,
    latitude: Math.round(latitude * 10) / 10,
    longitude: Math.round(longitude * 10) / 10,
    radiusKm: Math.max(10, record.location?.accuracy_radius ?? 10),
  };
}
