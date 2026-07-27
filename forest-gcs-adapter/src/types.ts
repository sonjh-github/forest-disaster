export type GeoPoint3D = {
  type: "Point";
  coordinates: [longitude: number, latitude: number, altitude?: number];
};

export type DroneTelemetry = {
  assetId: string;
  observedAt: string;
  geometry: GeoPoint3D;
  operationalStatus: "ONLINE" | "OPERATING" | "DEGRADED" | "OFFLINE";
  attributes: {
    systemId: number;
    componentId?: number;
    sourceAddress?: string;
    sourceAssetId?: string;
    altitudeM?: number;
    relativeAltitudeM?: number;
    headingDeg?: number;
    groundSpeedMps?: number;
    batteryPercent?: number;
    batteryVoltageV?: number;
    rollDeg?: number;
    pitchDeg?: number;
    yawDeg?: number;
    flightMode?: number;
    armed?: boolean;
    missionSequence?: number;
    mavlinkVersion?: number;
    source: "MAVLINK" | "SIMULATION" | "HTTP";
  };
};

export type IntegrationEnvelope<T> = {
  context: {
    eventId: string;
    requestId: string;
    sourceSystem: string;
    occurredAt: string;
    schemaVersion: "1.0";
  };
  data: T;
};

export type AdapterCommand = {
  command: string;
  assetId?: string;
  missionId?: string;
};
