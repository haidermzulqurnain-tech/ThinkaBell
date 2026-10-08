import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SubscribeModalClient } from "./SubscribeModalClient";

describe("SubscribeModalClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders without crashing", () => {
    render(<SubscribeModalClient />);
    expect(screen.queryByText("Get Deal Alerts")).toBeNull();
  });

  it("opens modal when open event is dispatched", async () => {
    render(<SubscribeModalClient productSlug="test-product" />);
    expect(screen.queryByText("Get Deal Alerts")).toBeNull();

    const event = new CustomEvent("open-subscribe-modal", {
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.getByText("Get Deal Alerts")).toBeDefined();
    });
  });

  it("closes modal when close button is clicked", async () => {
    render(<SubscribeModalClient />);

    const event = new CustomEvent("open-subscribe-modal", {
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.getByText("Get Deal Alerts")).toBeDefined();
    });

    const closeButton = screen.getByRole("button", { name: "" });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText("Get Deal Alerts")).toBeNull();
    });
  });
});
