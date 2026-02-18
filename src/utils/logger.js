const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m", // green
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  reset: "\x1b[0m",
};

const currentLevel = LEVELS[process.env.LOG_LEVEL || "debug"] ?? LEVELS.debug;

function formatTimestamp() {
  const d = new Date();
  return d.toISOString().replace("T", " ").replace("Z", "");
}

function log(level, message, meta = null) {
  if (LEVELS[level] < currentLevel) return;

  const color = COLORS[level];
  const reset = COLORS.reset;
  const tag = level.toUpperCase().padEnd(5);
  const timestamp = formatTimestamp();

  let line = `${color}[${timestamp}] ${tag}${reset} ${message}`;
  if (meta) {
    line += ` ${typeof meta === "string" ? meta : JSON.stringify(meta, null, 0)}`;
  }
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg, meta) => log("debug", msg, meta),
  info: (msg, meta) => log("info", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  error: (msg, meta) => log("error", msg, meta),
};
