import { describe, it, expect, vi } from "vitest";
import { partnerStackClient } from "./partnerStackClient";

describe("PartnerStackClient", () => {
  it("should throw error when API key is missing", async () => {
    await expect(partnerStackClient.searchProducts("ai writing")).rejects.toThrow("PartnerStack API key is not configured");
  });

  it("should throw error for getProductBySlug when API key is missing", async () => {
    await expect(partnerStackClient.getProductBySlug("nonexistent-slug")).rejects.toThrow("PartnerStack API key is not configured");
  });
});
