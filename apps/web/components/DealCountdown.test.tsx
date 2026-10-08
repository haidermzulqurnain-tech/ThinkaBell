import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DealCountdown } from "./DealCountdown";

describe("DealCountdown", () => {
  it("renders countdown with future date", () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    render(<DealCountdown endDate={futureDate} />);
    expect(screen.getByText(/ends in/i)).toBeDefined();
  });

  it("renders expired for past date", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    render(<DealCountdown endDate={pastDate} />);
    expect(screen.getByText(/expired/i)).toBeDefined();
  });
});
