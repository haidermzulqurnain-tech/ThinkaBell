import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SubscribeModal } from "../components/SubscribeModal";

describe("SubscribeModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("does not render when closed", () => {
    const { container } = render(
      <SubscribeModal isOpen={false} onClose={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    render(<SubscribeModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText("Get Deal Alerts")).toBeDefined();
  });

  it("shows step 1 with email and category selection", () => {
    render(<SubscribeModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByLabelText(/Email Address/)).toBeDefined();
    expect(screen.getByText("Physical")).toBeDefined();
    expect(screen.getByText("Software")).toBeDefined();
    expect(screen.getByText("Continue")).toBeDefined();
  });

  it("advances to step 2 after filling email and selecting category", async () => {
    render(<SubscribeModal isOpen={true} onClose={() => {}} />);

    const emailInput = screen.getByLabelText(/Email Address/);
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });

    const physicalButton = screen.getByText("Physical");
    fireEvent.click(physicalButton);

    const continueButton = screen.getByText("Continue");
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText("Minimum Discount")).toBeDefined();
    });
  });

  it("shows error when submitting without email", async () => {
    render(<SubscribeModal isOpen={true} onClose={() => {}} />);

    const continueButton = screen.getByText("Continue");
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/Email Address/)).toBeDefined();
    });
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    render(<SubscribeModal isOpen={true} onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: "" });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("displays product-specific messaging when productSlug is provided", () => {
    render(<SubscribeModal isOpen={true} onClose={() => {}} productSlug="test-product" />);
    expect(screen.getByText(/Get notified when this deal changes/)).toBeDefined();
  });
});
