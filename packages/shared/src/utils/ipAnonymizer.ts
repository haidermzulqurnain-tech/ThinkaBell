/**
 * Anonymizes IP addresses by masking the last octet for IPv4
 * and the last 80 bits for IPv6, in compliance with GDPR/CCPA.
 */

export function anonymizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;

  const trimmed = ip.trim();

  if (!trimmed) return null;

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length >= 4) {
      return `${parts[0]}:${parts[1]}:${parts[2]}:****`;
    }
    return trimmed;
  }

  const ipv4Parts = trimmed.split(".");
  if (ipv4Parts.length === 4) {
    return `${ipv4Parts[0]}.${ipv4Parts[1]}.${ipv4Parts[2]}.****`;
  }

  return trimmed;
}
