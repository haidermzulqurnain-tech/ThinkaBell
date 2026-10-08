import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransparencyBanner } from "./TransparencyBanner";

describe("TransparencyBanner", () => {
  it("renders default price transparency text", () => {
    render(<TransparencyBanner />);
    expect(screen.getByText(/price transparency/i)).toBeDefined();
    expect(screen.getByText(/verified/i)).toBeDefined();
  });

  it("renders promotional pricing text when dealType is promo", () => {
    render(<TransparencyBanner dealType="promo" />);
    expect(screen.getByText(/promotional pricing/i)).toBeDefined();
    expect(screen.getByText(/limited-time promotional price/i)).toBeDefined();
  });
});
