import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import { CompareTable } from "./CompareTable";
import type { Product } from "@thinkabell/shared";

vi.mock("next/navigation");
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src as string} alt={alt as string} {...props} />
  ),
}));

const mockPush = vi.fn();
const mockReplace = vi.fn();

const makeProduct = (overrides: Partial<Product>): Product => ({
  id: 1,
  name: "Product A",
  slug: "product-a",
  category: "physical",
  brand: "BrandA",
  current_price: 100,
  previous_price: 200,
  image_url: null,
  description: "Test product",
  tags: ["laptop"],
  affiliate_links: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const products: Product[] = [
  makeProduct({}),
  makeProduct({
    id: 2,
    name: "Product B",
    slug: "product-b",
    brand: "BrandB",
    current_price: 150,
    previous_price: 150,
    tags: ["headphones"],
  }),
];

describe("CompareTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("") as unknown as ReturnType<typeof useSearchParams>,
    );
  });

  it("renders all product names and brands", () => {
    render(<CompareTable products={products} />);
    expect(screen.getByText("Product A")).toBeDefined();
    expect(screen.getByText("Product B")).toBeDefined();
    expect(screen.getByText("BrandA")).toBeDefined();
    expect(screen.getByText("BrandB")).toBeDefined();
  });

  it("highlights the lowest price with a Best badge", () => {
    render(<CompareTable products={products} />);
    expect(screen.getByText("Best")).toBeDefined();
  });

  it("shows discount badge only when previous price exceeds current", () => {
    render(<CompareTable products={products} />);
    expect(screen.getByText("50% OFF")).toBeDefined();
    expect(screen.queryByText("0% OFF")).toBeNull();
  });

  it("removes a product and updates the URL with remaining slugs", () => {
    render(<CompareTable products={products} />);
    const removeButton = screen.getByRole("button", {
      name: /remove product a from comparison/i,
    });
    fireEvent.click(removeButton);
    expect(mockReplace).toHaveBeenCalledWith("/compare?slugs=product-b");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigates to deals when the last product is removed", () => {
    const singleProduct = products.slice(0, 1);
    render(<CompareTable products={singleProduct} />);
    const removeButton = screen.getByRole("button", {
      name: /remove product a from comparison/i,
    });
    fireEvent.click(removeButton);
    expect(mockPush).toHaveBeenCalledWith("/deals");
    expect(mockReplace).not.toHaveBeenCalled();
  });
});