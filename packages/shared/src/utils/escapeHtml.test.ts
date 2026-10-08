/**
 * @file packages/shared/src/utils/escapeHtml.test.ts
 * @description Unit tests for HTML escaping
 */

import { describe, it, expect } from "vitest";
import { escapeHtml } from "./escapeHtml";

describe("escapeHtml", () => {
  it("should escape all HTML-special characters", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  it("should escape ampersands first to avoid double-escaping", () => {
    expect(escapeHtml("a & b < c")).toBe("a &amp; b &lt; c");
  });

  it("should escape single and double quotes", () => {
    expect(escapeHtml(`it's "quoted"`)).toBe("it&#39;s &quot;quoted&quot;");
  });

  it("should return plain text unchanged", () => {
    expect(escapeHtml("ThinkaBell deal alerts")).toBe("ThinkaBell deal alerts");
  });

  it("should handle empty strings", () => {
    expect(escapeHtml("")).toBe("");
  });
});
