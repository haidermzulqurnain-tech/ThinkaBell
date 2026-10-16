type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveLogLevel(): LogLevel {
  const envLevel = (process.env.LOG_LEVEL ?? "").toLowerCase() as LogLevel;
  if (envLevel && envLevel in LEVEL_ORDER) return envLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const LOG_LEVEL = resolveLogLevel();

/** Maximum log file size before rotation (10 MB). */
const MAX_LOG_SIZE = 10 * 1024 * 1024;

/** Resolve the optional log file path from LOG_FILE env var. */
function resolveLogFile(): string | undefined {
  const file = process.env.LOG_FILE;
  if (!file) return undefined;
  const path = require("path");
  const root = file.startsWith("/") || file.includes(":\\") ? file : path.resolve(process.cwd(), file);
  return root;
}

const LOG_FILE = resolveLogFile();

/** Ensure the directory for the log file exists. */
function ensureLogDir(filePath: string): void {
  const fs = require("fs");
  const dir = require("path").dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Append one line to the log file, rotating if it exceeds MAX_LOG_SIZE.
 *
 * The log file is never exposed via any HTTP route — it is written only to
 * the local filesystem so operators can read it via the host's file manager
 * or SSH. This keeps runtime diagnostics out of the public attack surface.
 */
function appendLogFile(line: string): void {
  if (!LOG_FILE) return;
  const fs = require("fs");
  try {
    ensureLogDir(LOG_FILE);
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > MAX_LOG_SIZE) {
        fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
      }
    }
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // If the log file can't be written, fall back to console only.
  }
}

class Logger {
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): string {
    const timestamp = new Date().toISOString();
    const meta = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${meta}`;
  }

  private write(
    level: LogLevel,
    consoleMethod: "debug" | "info" | "warn" | "error",
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[LOG_LEVEL]) return;

    const line = this.formatMessage(level, message, context);

    // console.info/warn go to stdout; console.error goes to stderr; console.debug
    // is an alias for console.log (stdout) but is gated by LOG_LEVEL so it is
    // silent in production unless LOG_LEVEL=debug is set. Hostinger captures all
    // streams in the runtime log.
    console[consoleMethod](line);

    // Also write to the optional log file (never exposed via HTTP).
    appendLogFile(line);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write("debug", "debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write("info", "info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write("warn", "warn", message, context);
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const errObj =
      error instanceof Error ? { error: error.message, stack: error.stack } : { error };
    this.write("error", "error", message, { ...context, ...errObj });
  }
}

export const logger = new Logger();

export { LOG_LEVEL };
