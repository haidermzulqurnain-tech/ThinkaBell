import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceFreshnessBadge } from "./PriceFreshnessBadge";

describe("PriceFreshnessBadge", () => {
  it("renders verified just now for recent timestamp", () => {
    render(<PriceFreshnessBadge updatedAt={new Date().toISOString()} />);
    expect(screen.getByText(/verified just now/i)).toBeDefined();
  });

  it("renders hours ago for timestamps less than a day old", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    render(<PriceFreshnessBadge updatedAt={twoHoursAgo} />);
    expect(screen.getByText(/verified 2h ago/i)).toBeDefined();
  });

  it("renders days ago for timestamps older than a day", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<PriceFreshnessBadge updatedAt={threeDaysAgo} />);
    expect(screen.getByText(/verified 3 days ago/i)).toBeDefined();
  });
});
