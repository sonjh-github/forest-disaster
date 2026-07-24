import { randomUUID } from "node:crypto";
import { IDS } from "../integration-fixtures.js";

export const now = () => new Date().toISOString();
export const point = (lon, lat, altitude = 0) => ({ type: "Point", coordinates: [lon, lat, altitude] });
export const SITES = {
  wildfire: { longitude: 128.697, latitude: 36.352, maxRadiusM: 2_000 },
  landslide: { longitude: 127.326, latitude: 36.674, maxRadiusM: 1_000 },
};
export function sitePoint(domain, eastM = 0, northM = 0, altitude = 0) {
  const site = SITES[domain];
  if (!site) throw new Error(`지원하지 않는 현장: ${domain}`);
  const distance = Math.hypot(eastM, northM);
  if (distance > site.maxRadiusM) throw new Error(`${domain} 현장 허용 반경 ${site.maxRadiusM}m를 초과했습니다.`);
  const latitude = site.latitude + northM / 111_320;
  const longitude = site.longitude + eastM / (111_320 * Math.cos(site.latitude * Math.PI / 180));
  return point(Number(longitude.toFixed(6)), Number(latitude.toFixed(6)), altitude);
}
export const siteCoordinates = (domain, eastM = 0, northM = 0, altitude) => {
  const coordinates = sitePoint(domain, eastM, northM, altitude ?? 0).coordinates;
  return altitude == null ? coordinates.slice(0, 2) : coordinates;
};
export const line = (coordinates) => ({ type: "MultiLineString", coordinates: [coordinates] });
export const polygon = (coordinates) => ({ type: "MultiPolygon", coordinates: [[[...coordinates, coordinates[0]]]] });

export function envelope(eventId, sourceSystem, data) {
  return {
    context: { eventId, requestId: randomUUID(), sourceSystem, occurredAt: now(), schemaVersion: "1.0" },
    data: typeof data === "function" ? data() : data,
  };
}

export function definition({ id, name, domain, category, direction, eventId, sourceSystem, result, invoke }) {
  return {
    id, name, domain, category, direction,
    modes: [result && "result", invoke && "invoke"].filter(Boolean),
    createEnvelope(mode) {
      const data = mode === "invoke" ? invoke : result;
      if (!data) throw Object.assign(new Error(`${id}는 ${mode} 테스트를 지원하지 않습니다.`), { statusCode: 400 });
      return envelope(eventId, sourceSystem, data);
    },
  };
}

export { IDS };
