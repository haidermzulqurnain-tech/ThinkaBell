export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

export function encodeCursor(params: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(params)).toString("base64url");
}

export function decodeCursor(cursor: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildCursor(lastItem: { id: number; created_at: string }): string {
  return encodeCursor({ id: lastItem.id, created_at: lastItem.created_at });
}
