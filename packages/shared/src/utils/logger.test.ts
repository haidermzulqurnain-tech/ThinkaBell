/**
 * @file packages/shared/src/utils/logger.test.ts
 * @description Unit tests for the Logger class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Logger", () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("debug", () => {
    it("should call console.debug with formatted message", async () => {
      const { logger } = await import("./logger");
      logger.debug("Test debug message");

      expect(consoleDebugSpy).toHaveBeenCalled();
      const call = consoleDebugSpy.mock.calls[0]![0] as string;
      expect(call).toContain("[DEBUG]");
      expect(call).toContain("Test debug message");
    });

    it("should include context in debug message", async () => {
      const { logger } = await import("./logger");
      logger.debug("Test message", { userId: 123, action: "test" });

      const call = consoleDebugSpy.mock.calls[0]![0] as string;
      expect(call).toContain("userId");
      expect(call).toContain("123");
    });

    it("should include ISO timestamp", async () => {
      const { logger } = await import("./logger");
      logger.debug("Test");

      const call = consoleDebugSpy.mock.calls[0]![0] as string;
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("info", () => {
    it("should call console.info with formatted message", async () => {
      const { logger } = await import("./logger");
      logger.info("Test info message");

      expect(consoleInfoSpy).toHaveBeenCalled();
      const call = consoleInfoSpy.mock.calls[0]![0] as string;
      expect(call).toContain("[INFO]");
      expect(call).toContain("Test info message");
    });

    it("should include context object as JSON", async () => {
      const { logger } = await import("./logger");
      logger.info("Test", { key: "value", count: 42 });

      const call = consoleInfoSpy.mock.calls[0]![0] as string;
      expect(call).toContain('"key":"value"');
      expect(call).toContain('"count":42');
    });
  });

  describe("warn", () => {
    it("should call console.warn with formatted message", async () => {
      const { logger } = await import("./logger");
      logger.warn("Test warning");

      expect(consoleWarnSpy).toHaveBeenCalled();
      const call = consoleWarnSpy.mock.calls[0]![0] as string;
      expect(call).toContain("[WARN]");
      expect(call).toContain("Test warning");
    });

    it("should include context in warn message", async () => {
      const { logger } = await import("./logger");
      logger.warn("Warning!", { code: "W001" });

      const call = consoleWarnSpy.mock.calls[0]![0] as string;
      expect(call).toContain("W001");
    });
  });

  describe("error", () => {
    it("should call console.error with formatted message", async () => {
      const { logger } = await import("./logger");
      logger.error("Test error");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0]![0] as string;
      expect(call).toContain("[ERROR]");
      expect(call).toContain("Test error");
    });

    it("should extract error message from Error object", async () => {
      const { logger } = await import("./logger");
      const error = new Error("Something failed");
      logger.error("Test error", error);

      const call = consoleErrorSpy.mock.calls[0]![0] as string;
      expect(call).toContain("Something failed");
    });

    it("should include error stack when available", async () => {
      const { logger } = await import("./logger");
      const error = new Error("Stack test");
      logger.error("Test", error);

      const call = consoleErrorSpy.mock.calls[0]![0] as string;
      expect(call).toContain("stack");
    });

    it("should handle non-Error values", async () => {
      const { logger } = await import("./logger");
      logger.error("Test", "string error");

      const call = consoleErrorSpy.mock.calls[0]![0] as string;
      expect(call).toContain("string error");
    });

    it("should merge context with error info", async () => {
      const { logger } = await import("./logger");
      const error = new Error("Merged test");
      logger.error("Test", error, { userId: 999 });

      const call = consoleErrorSpy.mock.calls[0]![0] as string;
      expect(call).toContain("Merged test");
      expect(call).toContain("999");
    });
  });

  describe("formatting", () => {
    it("should format messages consistently", async () => {
      const { logger } = await import("./logger");
      logger.info("Hello World");

      const call = consoleInfoSpy.mock.calls[0]![0] as string;
      // Format: [timestamp] [LEVEL] message {context}
      expect(call).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Hello World/);
    });

    it("should handle messages with special characters", async () => {
      const { logger } = await import("./logger");
      logger.info("Test with 'quotes' and \"double quotes\"");

      const call = consoleInfoSpy.mock.calls[0]![0] as string;
      expect(call).toContain("Test with 'quotes'");
    });
  });
});