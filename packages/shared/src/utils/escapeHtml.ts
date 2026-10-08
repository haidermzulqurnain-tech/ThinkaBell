/**
 * Escape user-controlled strings before interpolating them into
 * HTML payloads (email bodies, server-rendered markup). Prevents
 * HTML injection when the rendered output is consumed by clients
 * that do not sanitize (email clients, legacy browsers).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
