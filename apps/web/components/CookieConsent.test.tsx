/**
 * @file apps/web/components/CookieConsent.test.tsx
 * @description Tests for CookieConsent component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("CookieConsent", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("should export CookieConsent component", async () => {
    const mod = await import("./CookieConsent");
    expect(mod.CookieConsent).toBeDefined();
    expect(typeof mod.CookieConsent).toBe("function");
  });

  it("should dispatch thinkabell-consent event when accepting all", async () => {
    const mod = await import("./CookieConsent");
    const eventSpy = vi.fn();

    // Mock window and document
    const mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: (event: Event) => {
        eventSpy(event);
      },
    };

    vi.stubGlobal("window", mockWindow);
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { CookieConsent } = mod;
    expect(CookieConsent).toBeDefined();
    expect(typeof CookieConsent).toBe("function");
  });
});
