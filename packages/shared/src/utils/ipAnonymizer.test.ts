import { describe, it, expect } from "vitest";
import { anonymizeIp } from "./ipAnonymizer";

describe("ipAnonymizer", () => {
  it("should anonymize IPv4 addresses", () => {
    expect(anonymizeIp("192.168.1.100")).toBe("192.168.1.****");
    expect(anonymizeIp("10.0.0.1")).toBe("10.0.0.****");
    expect(anonymizeIp("172.16.254.1")).toBe("172.16.254.****");
  });

  it("should anonymize IPv6 addresses", () => {
    expect(anonymizeIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe("2001:0db8:85a3:****");
  });

  it("should handle null and undefined", () => {
    expect(anonymizeIp(null)).toBeNull();
    expect(anonymizeIp(undefined)).toBeNull();
  });

  it("should handle empty strings", () => {
    expect(anonymizeIp("")).toBeNull();
    expect(anonymizeIp("   ")).toBeNull();
  });

  it("should preserve invalid IP strings", () => {
    expect(anonymizeIp("not-an-ip")).toBe("not-an-ip");
  });
});
