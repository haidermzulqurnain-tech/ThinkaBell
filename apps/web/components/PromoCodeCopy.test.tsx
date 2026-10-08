import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PromoCodeCopy } from "./PromoCodeCopy";

describe("PromoCodeCopy", () => {
  it("renders promo code", () => {
    render(<PromoCodeCopy code="TEST123" />);
    expect(screen.getByText("TEST123")).toBeDefined();
    expect(screen.getByText("Copy")).toBeDefined();
  });

  it("copies code to clipboard and shows copied state", async () => {
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(global.navigator, "clipboard", { value: mockClipboard });

    render(<PromoCodeCopy code="TEST123" />);
    const copyButton = screen.getByText("Copy");

    await fireEvent.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalledWith("TEST123");

    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeDefined();
    });
  });
});
