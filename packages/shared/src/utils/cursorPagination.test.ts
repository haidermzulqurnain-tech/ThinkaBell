import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, buildCursor } from "./cursorPagination";

describe("cursorPagination", () => {
  it("should encode and decode cursor", () => {
    const params = { id: 42, created_at: "2026-01-01T00:00:00Z" };
    const cursor = encodeCursor(params);
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual(params);
  });

  it("should return null for invalid cursor", () => {
    expect(decodeCursor("invalid-cursor")).toBeNull();
  });

  it("should build cursor from last item", () => {
    const lastItem = { id: 100, created_at: "2026-09-12T15:00:00Z" };
    const cursor = buildCursor(lastItem);
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual({ id: 100, created_at: "2026-09-12T15:00:00Z" });
  });

  it("should roundtrip through base64url encoding", () => {
    const original = { id: 1, created_at: "2026-01-01T00:00:00Z" };
    const cursor = encodeCursor(original);
    expect(cursor).not.toContain("+");
    expect(cursor).not.toContain("/");
    expect(cursor).not.toContain("=");
    expect(decodeCursor(cursor)).toEqual(original);
  });
});
