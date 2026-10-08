import { describe, it, expect, vi } from "vitest";
import { impactClient } from "./impactClient";

describe("ImpactClient", () => {
  it("should throw error when API key is missing", async () => {
    await expect(impactClient.searchOffers("developer tools")).rejects.toThrow("Impact API key and account ID are not configured");
  });

  it("should throw error for getOfferBySlug when API key is missing", async () => {
    await expect(impactClient.getOfferBySlug("nonexistent-slug")).rejects.toThrow("Impact API key and account ID are not configured");
  });
});
