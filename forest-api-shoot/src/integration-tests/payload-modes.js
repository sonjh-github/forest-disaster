const gradualFields = new Set([
  "signalStrengthDbm", "rssiDbm", "latencyMs", "rttMs", "throughputMbps",
  "dataRateMbps", "batteryPct", "confidence", "probability", "riskScore",
  "estimatedDepthM", "estimatedVolumeM3", "maxVelocityMps",
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function transform(value, field, options) {
  if (Array.isArray(value)) return value.map((item) => transform(item, field, options));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, transform(item, key, options)]));
  }
  if (typeof value !== "number") {
    if (field === "status" && options.condition === "network-outage") return "DEGRADED";
    if (field === "status" && options.condition === "recovery") return "ACTIVE";
    return value;
  }

  let next = value;
  if (options.variationMode === "gradual" && gradualFields.has(field)) {
    const direction = options.cycle % 8 < 4 ? 1 : -1;
    const step = field.toLowerCase().includes("signal") || field.toLowerCase().includes("rssi") ? 1 : Math.max(Math.abs(value) * 0.01, 0.01);
    next += direction * step;
  }
  if (options.condition === "network-outage") {
    if (field === "signalStrengthDbm" || field === "rssiDbm") next = -120;
    if (field === "throughputMbps" || field === "dataRateMbps") next = 0;
    if (field === "latencyMs" || field === "rttMs") next = 5_000;
  }
  if (options.condition === "high-latency" && (field === "latencyMs" || field === "rttMs")) next = Math.max(next, 2_000);
  if (options.condition === "weak-signal" && (field === "signalStrengthDbm" || field === "rssiDbm")) next = Math.min(next, -105);
  if (options.condition === "recovery") {
    if (field === "signalStrengthDbm" || field === "rssiDbm") next = -55;
    if (field === "latencyMs" || field === "rttMs") next = 30;
  }
  if (field === "confidence" || field === "probability") next = clamp(next, 0, 1);
  if (field === "batteryPct" || field === "riskScore") next = clamp(next, 0, 100);
  return Number(next.toFixed(4));
}

export function applyTestMode(envelope, options = {}) {
  const variationMode = options.variationMode === "gradual" ? "gradual" : "fixed";
  const condition = ["network-outage", "high-latency", "weak-signal", "recovery"].includes(options.condition)
    ? options.condition
    : null;
  const cycle = Math.max(0, Number(options.cycle) || 0);
  return {
    context: {
      ...envelope.context,
      sourceSystem: condition ? `${envelope.context.sourceSystem}:${condition}` : envelope.context.sourceSystem,
    },
    data: transform(envelope.data, "", { variationMode, condition, cycle }),
  };
}
