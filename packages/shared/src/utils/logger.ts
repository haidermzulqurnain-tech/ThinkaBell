type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const meta = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${meta}`;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.info(this.formatMessage("info", message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(this.formatMessage("warn", message, context));
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const errObj = error instanceof Error ? { error: error.message, stack: error.stack } : { error };
    console.error(this.formatMessage("error", message, { ...context, ...errObj }));
  }
}

export const logger = new Logger();
