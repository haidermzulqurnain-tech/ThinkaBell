/**
 * @file packages/shared/src/api/notificationClient.test.ts
 * @description Unit tests for NotificationClient push/email delivery
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetEnv } from "@thinkabell/config";

const originalEnv = process.env;

describe("NotificationClient", () => {
  beforeEach(() => {
    vi.resetModules();
    resetEnv();
    process.env = { ...originalEnv };
  });

  describe("sendPush", () => {
    it("should throw error when OneSignal credentials are missing", async () => {
      process.env.ONESIGNAL_APP_ID = "";
      process.env.ONESIGNAL_REST_API_KEY = "";

      const { notificationClient } = await import("./notificationClient");
      await expect(
        notificationClient.sendPush("player-1", {
          title: "Test Push",
          message: "Hello",
          url: "https://thinkabell.click/deal/test",
        }),
      ).rejects.toThrow("OneSignal credentials are not configured");
    });

    it("should send push via OneSignal when credentials are configured", async () => {
      process.env.ONESIGNAL_APP_ID = "test-app-id";
      process.env.ONESIGNAL_REST_API_KEY = "test-api-key";

      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        } as Response),
      );
      vi.stubGlobal("fetch", mockFetch);

      const { notificationClient } = await import("./notificationClient");
      const result = await notificationClient.sendPush("player-1", {
        title: "Test Push",
        message: "Hello",
        url: "https://thinkabell.click/deal/test",
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://onesignal.com/api/v1/notifications",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Basic test-api-key",
          }),
        }),
      );

      vi.unstubAllGlobals();
    });

    it("should return false on OneSignal HTTP error", async () => {
      process.env.ONESIGNAL_APP_ID = "test-app-id";
      process.env.ONESIGNAL_REST_API_KEY = "test-api-key";

      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve("Bad Request"),
        } as Response),
      );
      vi.stubGlobal("fetch", mockFetch);

      const { notificationClient } = await import("./notificationClient");
      const result = await notificationClient.sendPush("player-1", {
        title: "Test Push",
        message: "Hello",
        url: "https://thinkabell.click/deal/test",
      });

      expect(result).toBe(false);

      vi.unstubAllGlobals();
    });

    it("should return false on network failure", async () => {
      process.env.ONESIGNAL_APP_ID = "test-app-id";
      process.env.ONESIGNAL_REST_API_KEY = "test-api-key";

      const mockFetch = vi.fn(() => Promise.reject(new Error("Network error")));
      vi.stubGlobal("fetch", mockFetch);

      const { notificationClient } = await import("./notificationClient");
      const result = await notificationClient.sendPush("player-1", {
        title: "Test Push",
        message: "Hello",
        url: "https://thinkabell.click/deal/test",
      });

      expect(result).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  describe("sendEmail", () => {
    it("should throw error when Brevo credentials are missing", async () => {
      process.env.BREVO_API_KEY = "";

      const { notificationClient } = await import("./notificationClient");
      await expect(
        notificationClient.sendEmail("user@example.com", {
          subject: "Test Email",
          body: "Hello from ThinkaBell",
        }),
      ).rejects.toThrow("Brevo API key is not configured");
    });

    it("should send email via Brevo when credentials are configured", async () => {
      process.env.BREVO_API_KEY = "test-brevo-key";
      process.env.BREVO_SENDER_EMAIL = "noreply@thinkabell.click";
      process.env.BREVO_SENDER_NAME = "ThinkaBell";

      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        } as Response),
      );
      vi.stubGlobal("fetch", mockFetch);

      const { notificationClient } = await import("./notificationClient");
      const result = await notificationClient.sendEmail("user@example.com", {
        subject: "Test Email",
        body: "Hello from ThinkaBell",
        dealUrl: "https://thinkabell.click/deal/test",
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.brevo.com/v3/smtp/email",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "api-key": "test-brevo-key",
          }),
        }),
      );

      vi.unstubAllGlobals();
    });

    it("should return false on Brevo HTTP error", async () => {
      process.env.BREVO_API_KEY = "test-brevo-key";
      process.env.BREVO_SENDER_EMAIL = "noreply@thinkabell.click";
      process.env.BREVO_SENDER_NAME = "ThinkaBell";

      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Server Error"),
        } as Response),
      );
      vi.stubGlobal("fetch", mockFetch);

      const { notificationClient } = await import("./notificationClient");
      const result = await notificationClient.sendEmail("user@example.com", {
        subject: "Test Email",
        body: "Hello from ThinkaBell",
      });

      expect(result).toBe(false);

      vi.unstubAllGlobals();
    });

    it("should return false on network failure", async () => {
      process.env.BREVO_API_KEY = "test-brevo-key";
      process.env.BREVO_SENDER_EMAIL = "noreply@thinkabell.click";
      process.env.BREVO_SENDER_NAME = "ThinkaBell";

      const mockFetch = vi.fn(() => Promise.reject(new Error("Network error")));
      vi.stubGlobal("fetch", mockFetch);

      const { notificationClient } = await import("./notificationClient");
      const result = await notificationClient.sendEmail("user@example.com", {
        subject: "Test Email",
        body: "Hello from ThinkaBell",
      });

      expect(result).toBe(false);

      vi.unstubAllGlobals();
    });
  });
});
