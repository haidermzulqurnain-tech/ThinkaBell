import { describe, it, expect, vi } from "vitest";
import { appSumoClient } from "./appSumoClient";

describe("AppSumoClient", () => {
  it("should throw error when API key is missing", async () => {
    await expect(appSumoClient.searchDeals("productivity")).rejects.toThrow("AppSumo API key is not configured");
  });

  it("should throw error for getDealBySlug when API key is missing", async () => {
    await expect(appSumoClient.getDealBySlug("nonexistent-slug")).rejects.toThrow("AppSumo API key is not configured");
  });
});
