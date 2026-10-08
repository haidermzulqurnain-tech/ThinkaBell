import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertQualityScore } from "./AlertQualityScore";

describe("AlertQualityScore", () => {
  it("renders high confidence label for score >= 80", () => {
    render(<AlertQualityScore score={85} />);
    expect(screen.getByText("High confidence")).toBeDefined();
    expect(screen.getByText("85")).toBeDefined();
  });

  it("renders good value label for score 60-79", () => {
    render(<AlertQualityScore score={65} />);
    expect(screen.getByText("Good value")).toBeDefined();
  });

  it("renders fair deal label for score 40-59", () => {
    render(<AlertQualityScore score={45} />);
    expect(screen.getByText("Fair deal")).toBeDefined();
  });

  it("renders marginal label for score 20-39", () => {
    render(<AlertQualityScore score={25} />);
    expect(screen.getByText("Marginal")).toBeDefined();
  });

  it("renders low confidence label for score < 20", () => {
    render(<AlertQualityScore score={10} />);
    expect(screen.getByText("Low confidence")).toBeDefined();
  });

  it("renders explainer text", () => {
    render(<AlertQualityScore score={50} />);
    expect(screen.getByText(/score reflects discount depth/i)).toBeDefined();
  });
});
