const colors = {
  reset: "\u001b[0m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
};

function write(level: string, origin: string, message: string, detail?: unknown) {
  const color = level === "ERROR" ? colors.red : level === "WARN" ? colors.yellow : level === "OK" ? colors.green : colors.cyan;
  const suffix = detail === undefined ? "" : ` ${JSON.stringify(detail)}`;
  console.log(`${color}[${origin}]${colors.reset} ${message}${suffix}`);
}

export const logger = {
  info: (origin: string, message: string, detail?: unknown) => write("INFO", origin, message, detail),
  ok: (origin: string, message: string, detail?: unknown) => write("OK", origin, message, detail),
  warn: (origin: string, message: string, detail?: unknown) => write("WARN", origin, message, detail),
  error: (origin: string, message: string, detail?: unknown) => write("ERROR", origin, message, detail),
};
