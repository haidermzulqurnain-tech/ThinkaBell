import { describe, it, expect } from "vitest";
import { calculateProgramStability } from "./programStability";

describe("calculateProgramStability", () => {
  it("should return unknown for empty input", () => {
    const result = calculateProgramStability("");
    expect(result.level).toBe("unknown");
    expect(result.score).toBe(50);
  });

  it("should return high stability for established programs", () => {
    const result = calculateProgramStability("This is an established public company with years in business and accredited status.");
    expect(result.level).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it("should return low stability for startups", () => {
    const result = calculateProgramStability("New startup with pre-revenue seed funding.");
    expect(result.level).toBe("low");
    expect(result.score).toBeLessThan(50);
  });

  it("should cap score at 100", () => {
    const result = calculateProgramStability("Established public company with years in business, accredited, growing, profitable, funded, b2b, enterprise.");
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
