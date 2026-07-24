const ansi = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
};

const colorEnabled = process.env.NO_COLOR == null;
const color = (value, code) => colorEnabled ? `${code}${value}${ansi.reset}` : value;

function details(value = {}) {
  return Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => `${key}=${item}`)
    .join(" ");
}

const ignoredInfoEvents = new Set(["request.complete", "request.succeeded", "tick.completed"]);

function write(level, origin, event, value) {
  if (level === "INFO" && (ignoredInfoEvents.has(event) || origin.startsWith("http:"))) return;
  const timestamp = color(new Date().toLocaleTimeString("ko-KR", { hour12: false }), ansi.dim);
  const prefix = color(`[${origin}]`, level === "ERROR" ? ansi.red : ansi.cyan);
  const suffix = details(value);
  const line = `${timestamp} ${prefix} ${event}${suffix ? ` ${color(suffix, ansi.dim)}` : ""}`;
  (level === "ERROR" ? console.error : console.log)(line);
}

export const logger = {
  info: (origin, event, value) => write("INFO", origin, event, value),
  warn: (origin, event, value) => write("WARN", origin, event, value),
  error: (origin, event, value) => write("ERROR", origin, event, value),
};
