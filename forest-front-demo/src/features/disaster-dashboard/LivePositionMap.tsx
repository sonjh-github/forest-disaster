import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ApiRecord } from "../../http-api";
import type { LiveLocation } from "./UnifiedDisasterDashboard";

type Props = {
  locations: LiveLocation[];
  changedUntil: Record<string, number>;
  highlightDurationMs: number;
  eventCenter: [number, number] | null;
  focusCenter: [number, number] | null;
  eventId: string;
  showResources: boolean;
  showEvent: boolean;
  selectedKey: string | null;
  onLocationSelect: (location: LiveLocation) => void;
  domainLayers: Record<string, ApiRecord[]>;
  visibleLayerIds: Set<string>;
};

const mapStyle: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": 0, "raster-brightness-max": 1 } }],
};

function keyOf(location: LiveLocation) {
  return `${location.kind}-${location.id}`;
}

const shortCategoryNames: Record<string, string> = {
  PERSONNEL: "인원", UAV: "무인기", MAIN_RELAY_DRONE: "주중계", SERVICE_RELAY_DRONE: "서비스중계",
  RTK_TERMINAL: "RTK", RTK_BASE_LPWA_GATEWAY: "RTK기준국", TVWS_BASE_STATION: "TVWS기지국",
  TVWS_CPE: "TVWS단말", LTE_GATEWAY: "LTE", PRIVATE_5G_NTN_GATEWAY: "5G·위성",
  RADIO_GATEWAY_400MHZ: "무전", COMMAND_VEHICLE: "지휘차량", FIXED_RELAY: "고정중계",
  MOBILE_RELAY: "이동중계", GCS: "GCS", REF_AP: "기준AP", ROVER_AP: "이동AP",
  RSSI_DETECTOR: "신호탐지", IR_UWB_GPR: "생체탐지", ASSET: "장비",
};

function compactLabel(location: LiveLocation) {
  const type = shortCategoryNames[location.category] ?? "장비";
  const name = location.label.length > 12 ? `${location.label.slice(0, 11)}…` : location.label;
  return `${type} · ${name}`;
}

function createLabelImage(text: string) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.font = "700 20px sans-serif";
  const width = Math.min(310, Math.ceil(context.measureText(text).width) + 24);
  canvas.width = width;
  canvas.height = 42;
  context.font = "700 20px sans-serif";
  context.fillStyle = "rgba(255,255,255,0.94)";
  context.strokeStyle = "rgba(31,55,72,0.24)";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(1, 1, width - 2, 40, 9);
  context.fill();
  context.stroke();
  context.fillStyle = "#203543";
  context.textBaseline = "middle";
  context.fillText(text, 12, 22, width - 24);
  return context.getImageData(0, 0, width, 42);
}

const domainLayerStyle: Record<string, { type: "line" | "fill" | "circle"; color: string; opacity?: number }> = {
  firelines: { type: "line", color: "#e23f2f" },
  "spread-predictions": { type: "fill", color: "#f06432", opacity: 0.05 },
  "communication-coverages": { type: "fill", color: "#158bcb", opacity: 0.14 },
  "slope-assessments": { type: "fill", color: "#8a52c7", opacity: 0.12 },
  "debris-flow-paths": { type: "line", color: "#70451f" },
  "debris-flow-areas": { type: "fill", color: "#b36a32", opacity: 0.16 },
  "victim-candidates": { type: "circle", color: "#db3158" },
  "rssi-detections": { type: "circle", color: "#f2a527" },
  "ai-ran-coverages": { type: "fill", color: "#18a1a8", opacity: 0.12 },
  "relay-placement-candidates": { type: "circle", color: "#1678c8" },
  "ignition-detections": { type: "circle", color: "#f02f22" },
  "vehicle-detections": { type: "circle", color: "#4569d4" },
  "road-segmentations": { type: "fill", color: "#53677a", opacity: 0.13 },
  "change-detections": { type: "fill", color: "#d88324", opacity: 0.15 },
  "vital-signal-detections": { type: "circle", color: "#d92f85" },
};

function geometryOf(layerId: string, row: ApiRecord) {
  const candidates = layerId === "firelines" ? [row.fireline]
    : layerId === "spread-predictions" ? [row.predictedArea]
    : layerId === "communication-coverages" ? [row.coverageArea, row.shadowArea]
    : layerId === "slope-assessments" ? [row.geometry]
    : layerId === "debris-flow-paths" ? [row.flowPath]
    : layerId === "debris-flow-areas" ? [row.affectedArea]
    : layerId === "victim-candidates" ? [row.estimatedPosition]
    : layerId === "rssi-detections" ? [row.estimatedPosition, row.detectorPosition]
    : [row.resultGeometry];
  return candidates.find((candidate) => candidate && typeof candidate === "object" && "type" in candidate) as GeoJSON.Geometry | undefined;
}

function featureCollection(layerId: string, rows: ApiRecord[]): GeoJSON.FeatureCollection {
  const timeOf = (row: ApiRecord) => Date.parse(String(
    row.observedAt ?? row.baseTime ?? row.assessedAt ?? row.lastDetectedAt ?? row.detectedAt ?? row.generatedAt ?? 0
  ));
  const sortedRows = [...rows].sort((a, b) => timeOf(b) - timeOf(a));
  const displayRows = layerId === "firelines" || layerId === "spread-predictions"
    ? sortedRows.slice(0, 1)
    : sortedRows.filter((row, index, all) => {
        const signature = JSON.stringify(geometryOf(layerId, row));
        return all.findIndex((candidate) => JSON.stringify(geometryOf(layerId, candidate)) === signature) === index;
      }).slice(0, 20);
  return {
    type: "FeatureCollection",
    features: displayRows.flatMap((row, index) => {
      const geometry = geometryOf(layerId, row);
      return geometry ? [{ type: "Feature", id: String(row.id ?? row.firelineId ?? row.predictionId ?? row.assessmentId ?? row.victimCandidateId ?? row.detectionId ?? index), geometry, properties: { layerId } } as GeoJSON.Feature] : [];
    }),
  };
}

function locationFeatureCollection(locations: LiveLocation[], changedUntil: Record<string, number>, selectedKey: string | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: locations.map((location) => {
      const key = keyOf(location);
      return {
        type: "Feature",
        id: key,
        geometry: { type: "Point", coordinates: [location.longitude, location.latitude] },
        properties: {
          key,
          kind: location.kind,
          category: location.category,
          labelIcon: `field-label-${key}`,
          changed: (changedUntil[key] ?? 0) > Date.now(),
          selected: selectedKey === key,
        },
      };
    }),
  };
}

export default function LivePositionMap({ locations, changedUntil, highlightDurationMs, eventCenter, focusCenter, eventId, showResources, showEvent, selectedKey, onLocationSelect, domainLayers, visibleLayerIds }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mutedBasemap, setMutedBasemap] = useState(false);
  const [tileDegraded, setTileDegraded] = useState(false);
  const selectedEventRef = useRef("");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [128.7, 36.35],
      zoom: 12,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    const handleError = (event: { error?: Error }) => {
      if (/tile|source|network|fetch/i.test(String(event.error?.message ?? ""))) setTileDegraded(true);
    };
    map.on("error", handleError);
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    mapRef.current = map;
    return () => {
      resizeObserver.disconnect();
      map.off("error", handleError);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (map.getLayer("osm")) map.setPaintProperty("osm", "raster-opacity", mutedBasemap ? 0.2 : 1);
    };
    if (map.isStyleLoaded()) apply(); else map.once("load", apply);
    return () => { map.off("load", apply); };
  }, [mutedBasemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !eventCenter) return;
    if (selectedEventRef.current === eventId) return;
    selectedEventRef.current = eventId;
    const targetCenter = focusCenter ?? eventCenter;
    const nearbyLocations = locations.filter((location) =>
      Math.hypot(location.longitude - targetCenter[0], location.latitude - targetCenter[1]) <= 0.08
    );
    if (nearbyLocations.length >= 2) {
      const bounds = new maplibregl.LngLatBounds();
      nearbyLocations.forEach((location) => bounds.extend([location.longitude, location.latitude]));
      if (Math.hypot(eventCenter[0] - targetCenter[0], eventCenter[1] - targetCenter[1]) <= 0.08) {
        bounds.extend(eventCenter);
      }
      map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 700 });
    } else {
      map.easeTo({ center: targetCenter, zoom: 14, duration: 700 });
    }
  }, [eventCenter, focusCenter, eventId, locations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const render = () => {
      for (const [layerId, rows] of Object.entries(domainLayers)) {
        const style = domainLayerStyle[layerId];
        if (!style) continue;
        const sourceId = `domain-source-${layerId}`;
        const mapLayerId = `domain-layer-${layerId}`;
        const data = featureCollection(layerId, rows);
        const source = map.getSource(sourceId) as GeoJSONSource | undefined;
        if (source) source.setData(data);
        else map.addSource(sourceId, { type: "geojson", data });
        if (!map.getLayer(mapLayerId)) {
          if (style.type === "line") map.addLayer({ id: mapLayerId, type: "line", source: sourceId, paint: { "line-color": style.color, "line-width": 4, "line-opacity": 0.88 } });
          if (style.type === "fill") map.addLayer({ id: mapLayerId, type: "fill", source: sourceId, paint: { "fill-color": style.color, "fill-opacity": style.opacity ?? 0.16, "fill-outline-color": style.color } });
          if (style.type === "circle") map.addLayer({ id: mapLayerId, type: "circle", source: sourceId, paint: { "circle-color": style.color, "circle-radius": layerId === "victim-candidates" ? 11 : 7, "circle-opacity": 0.75, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
        }
        map.setLayoutProperty(mapLayerId, "visibility", visibleLayerIds.has(layerId) ? "visible" : "none");
      }
    };
    if (map.isStyleLoaded()) render(); else map.once("load", render);
    return () => { map.off("load", render); };
  }, [domainLayers, visibleLayerIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const render = () => {
      const eventData: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: eventCenter ? [{
          type: "Feature",
          id: "event-origin",
          geometry: { type: "Point", coordinates: eventCenter },
          properties: {},
        }] : [],
      };
      const eventSource = map.getSource("event-origin-source") as GeoJSONSource | undefined;
      if (eventSource) eventSource.setData(eventData);
      else map.addSource("event-origin-source", { type: "geojson", data: eventData });
      if (!map.getLayer("event-origin-halo")) map.addLayer({
        id: "event-origin-halo", type: "circle", source: "event-origin-source",
        paint: { "circle-radius": 17, "circle-color": "#ed2f38", "circle-opacity": 0.18 },
      });
      if (!map.getLayer("event-origin-point")) map.addLayer({
        id: "event-origin-point", type: "circle", source: "event-origin-source",
        paint: { "circle-radius": 9, "circle-color": "#e32636", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
      });
      if (!map.hasImage("event-origin-label")) {
        const image = createLabelImage("재난 발생지점");
        if (image) map.addImage("event-origin-label", image, { pixelRatio: 2 });
      }
      if (!map.getLayer("event-origin-label")) map.addLayer({
        id: "event-origin-label", type: "symbol", source: "event-origin-source",
        layout: { "icon-image": "event-origin-label", "icon-anchor": "left", "icon-offset": [13, 0], "icon-allow-overlap": false, "icon-padding": 3 },
      });

      for (const location of locations) {
        const imageId = `field-label-${keyOf(location)}`;
        if (!map.hasImage(imageId)) {
          const image = createLabelImage(compactLabel(location));
          if (image) map.addImage(imageId, image, { pixelRatio: 2 });
        }
      }
      const resourceData = locationFeatureCollection(locations, changedUntil, selectedKey);
      const resourceSource = map.getSource("field-resource-source") as GeoJSONSource | undefined;
      if (resourceSource) resourceSource.setData(resourceData);
      else map.addSource("field-resource-source", { type: "geojson", data: resourceData });
      if (!map.getLayer("field-resource-halo")) map.addLayer({
        id: "field-resource-halo", type: "circle", source: "field-resource-source",
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "changed"], false], 16, ["boolean", ["get", "selected"], false], 14, 0],
          "circle-color": ["case", ["boolean", ["get", "selected"], false], "#1e77b4", "#ffd74f"],
          "circle-opacity": ["case", ["any", ["boolean", ["get", "changed"], false], ["boolean", ["get", "selected"], false]], 0.28, 0],
        },
      });
      for (const index of [1, 2, 3]) {
        const layerId = `field-resource-pulse-${index}`;
        if (!map.getLayer(layerId)) map.addLayer({
          id: layerId,
          type: "circle",
          source: "field-resource-source",
          paint: {
            "circle-radius": ["case", ["boolean", ["get", "changed"], false], 12, 0],
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": "#00dca0",
            "circle-stroke-width": 2.6,
            "circle-stroke-opacity": 0,
          },
        });
      }
      if (!map.getLayer("field-resource-point")) map.addLayer({
        id: "field-resource-point", type: "circle", source: "field-resource-source",
        paint: {
          "circle-radius": ["case", ["==", ["get", "kind"], "personnel"], 8, 9],
          "circle-color": [
            "match", ["get", "category"],
            "PERSONNEL", "#35b985",
            "UAV", "#4b95e5", "MAIN_RELAY_DRONE", "#4b95e5", "SERVICE_RELAY_DRONE", "#4b95e5",
            "IR_UWB_GPR", "#e97fb5", "RSSI_DETECTOR", "#e97fb5",
            "TVWS_BASE_STATION", "#37bfd0", "TVWS_CPE", "#37bfd0", "LTE_GATEWAY", "#37bfd0",
            "PRIVATE_5G_NTN_GATEWAY", "#37bfd0", "#f0a73d",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["case", ["boolean", ["get", "selected"], false], 4, 2],
        },
      });
      if (!map.getLayer("field-resource-label")) map.addLayer({
        id: "field-resource-label", type: "symbol", source: "field-resource-source",
        layout: {
          "icon-image": ["get", "labelIcon"],
          "icon-anchor": "left",
          "icon-offset": [13, 0],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-padding": 4,
        },
      });

      for (const layerId of ["event-origin-halo", "event-origin-point", "event-origin-label"]) {
        map.setLayoutProperty(layerId, "visibility", showEvent ? "visible" : "none");
      }
      for (const layerId of ["field-resource-halo", "field-resource-pulse-1", "field-resource-pulse-2", "field-resource-pulse-3", "field-resource-point", "field-resource-label"]) {
        map.setLayoutProperty(layerId, "visibility", showResources ? "visible" : "none");
      }
      // 고정 순서: 배경지도 → AI 분석 결과 → 발생지점 → 수신 펄스 → 자산·인원.
      for (const layerId of Object.keys(domainLayerStyle).map((id) => `domain-layer-${id}`)) {
        if (map.getLayer(layerId)) map.moveLayer(layerId);
      }
      for (const layerId of [
        "event-origin-halo", "event-origin-point", "event-origin-label",
        "field-resource-halo", "field-resource-pulse-1", "field-resource-pulse-2", "field-resource-pulse-3",
        "field-resource-point", "field-resource-label",
      ]) {
        if (map.getLayer(layerId)) map.moveLayer(layerId);
      }
    };
    const selectResource = (event: maplibregl.MapLayerMouseEvent) => {
      const key = String(event.features?.[0]?.properties?.key ?? "");
      const location = locations.find((item) => keyOf(item) === key);
      if (location) onLocationSelect(location);
    };
    const pointer = () => { map.getCanvas().style.cursor = "pointer"; };
    const unpointer = () => { map.getCanvas().style.cursor = ""; };
    if (map.isStyleLoaded()) render(); else map.once("load", render);
    map.on("click", "field-resource-point", selectResource);
    map.on("click", "field-resource-label", selectResource);
    map.on("mouseenter", "field-resource-point", pointer);
    map.on("mouseenter", "field-resource-label", pointer);
    map.on("mouseleave", "field-resource-point", unpointer);
    map.on("mouseleave", "field-resource-label", unpointer);
    return () => {
      map.off("load", render);
      map.off("click", "field-resource-point", selectResource);
      map.off("click", "field-resource-label", selectResource);
      map.off("mouseenter", "field-resource-point", pointer);
      map.off("mouseenter", "field-resource-label", pointer);
      map.off("mouseleave", "field-resource-point", unpointer);
      map.off("mouseleave", "field-resource-label", unpointer);
    };
  }, [locations, changedUntil, eventCenter, onLocationSelect, selectedKey, showEvent, showResources]);

  useEffect(() => {
    const map = mapRef.current;
    const hasActivePulse = Object.values(changedUntil).some((until) => until > Date.now());
    if (!map || !showResources) return;
    if (!hasActivePulse) {
      if (map.getLayer("field-resource-point")) {
        map.setPaintProperty("field-resource-point", "circle-stroke-color", "#ffffff");
        map.setPaintProperty("field-resource-point", "circle-stroke-width", [
          "case", ["boolean", ["get", "selected"], false], 4, 2,
        ]);
      }
      if (map.getLayer("field-resource-halo")) {
        map.setPaintProperty("field-resource-halo", "circle-radius", [
          "case", ["boolean", ["get", "changed"], false], 16,
          ["boolean", ["get", "selected"], false], 14, 0,
        ]);
        map.setPaintProperty("field-resource-halo", "circle-color", [
          "case", ["boolean", ["get", "selected"], false], "#1e77b4", "#ffd74f",
        ]);
        map.setPaintProperty("field-resource-halo", "circle-opacity", [
          "case", ["any", ["boolean", ["get", "changed"], false], ["boolean", ["get", "selected"], false]], 0.28, 0,
        ]);
      }
      return;
    }
    const startedAt = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const animate = (now: number) => {
      const elapsed = reduceMotion ? 500 : now - startedAt;
      const intensity = reduceMotion ? 1 : Math.sin(Math.min(1, elapsed / highlightDurationMs) * Math.PI);
      const strokeWidth = 2 + intensity * 1.2;
      const strokeColor = `rgb(255, ${Math.round(88 + intensity * 146)}, 0)`;
      if (map.getLayer("field-resource-point")) {
        map.setPaintProperty("field-resource-point", "circle-stroke-color", strokeColor);
        map.setPaintProperty("field-resource-point", "circle-stroke-width", strokeWidth);
      }
      if (map.getLayer("field-resource-halo")) {
        map.setPaintProperty("field-resource-halo", "circle-radius", 14 + intensity * 2);
        map.setPaintProperty("field-resource-halo", "circle-color", "#ffb300");
        map.setPaintProperty("field-resource-halo", "circle-opacity", 0.12 + intensity * 0.28);
      }
      if (!reduceMotion && elapsed < highlightDurationMs) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [changedUntil, highlightDurationMs, showResources]);

  return (
    <div className={`live-map-shell${tileDegraded ? " is-tile-degraded" : ""}`}>
      <div ref={containerRef} className="live-basemap" aria-label="실시간 현장 지도" />
      <div className="basemap-switch" aria-label="배경지도 전환">
        <button type="button" className={!mutedBasemap ? "active" : ""} aria-pressed={!mutedBasemap} onClick={() => setMutedBasemap(false)}>일반지도</button>
        <button type="button" className={mutedBasemap ? "active" : ""} aria-pressed={mutedBasemap} onClick={() => setMutedBasemap(true)}>정보강조</button>
      </div>
      <section className="map-meaning-legend" aria-label="지도 범례">
        <strong>범례</strong>
        <span><i className="personnel" />현장 인원</span>
        <span><i className="asset" />장비·차량</span>
        <span><i className="observed" />관측 결과</span>
        <span><i className="predicted" />AI 예측</span>
      </section>
      {tileDegraded && <p className="tile-degraded-notice" role="status">배경지도 연결 지연 · 좌표와 현장 객체는 계속 표시합니다</p>}
    </div>
  );
}
