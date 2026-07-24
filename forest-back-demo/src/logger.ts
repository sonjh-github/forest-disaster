function fields(details: Record<string, unknown> = {}) {
  return Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${typeof value === "string" && value.includes(" ") ? JSON.stringify(value) : value}`)
    .join(" ");
}

const colorEnabled = process.env.NO_COLOR == null;
const ansi = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
};

function color(value: string, code: string) {
  return colorEnabled ? `${code}${value}${ansi.reset}` : value;
}

function write(level: "INFO" | "ERROR", origin: string, event: string, details?: Record<string, unknown>) {
  const safeOrigin = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const status = Number(details?.status ?? (level === "ERROR" ? 500 : 0));
  const statusColor = status >= 500 ? ansi.red : status >= 400 ? ansi.yellow : ansi.green;
  const prefix = color(`[${safeOrigin}]`, level === "ERROR" ? ansi.red : ansi.cyan);
  const timestamp = color(new Date().toLocaleTimeString("ko-KR", { hour12: false }), ansi.dim);
  const method = details?.method ? color(String(details.method).padEnd(7), ansi.yellow) : "";
  const path = details?.path ? String(details.path) : "";
  const statusText = status ? color(String(status), statusColor) : "";
  const duration = details?.durationMs != null ? color(`${details.durationMs}ms`, ansi.dim) : "";
  const reserved = new Set(["method", "path", "status", "durationMs"]);
  const extra = fields(Object.fromEntries(Object.entries(details ?? {}).filter(([key]) => !reserved.has(key))));
  const requestSummary = [method, path, statusText && `→ ${statusText}`, duration && `(${duration})`].filter(Boolean).join(" ");
  const message = event === "http.request.complete" ? requestSummary : `${event}${requestSummary ? ` ${requestSummary}` : ""}`;
  const line = `${timestamp} ${prefix} ${message}${extra ? ` ${color(extra, ansi.dim)}` : ""}`;
  (level === "ERROR" ? console.error : console.log)(line);
}

export const serverLogger = {
  info: (origin: string, event: string, details?: Record<string, unknown>) => write("INFO", origin, event, details),
  error: (origin: string, event: string, details?: Record<string, unknown>) => write("ERROR", origin, event, details),
};
