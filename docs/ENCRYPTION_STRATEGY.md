# ThinkaBell Field-Level Encryption Strategy

This document defines the encryption strategy for sensitive data at rest in the ThinkaBell platform.

---

## 1. Data Classification

### Sensitive Data (Requires Encryption)
| Data Field | Table | Classification | Reason |
|------------|-------|----------------|--------|
| `subscribers.email` | subscribers | PII | GDPR/CCPA personal identifier |
| `subscribers.push_subscription_id` | subscribers | Sensitive | Push notification token |
| `subscribers.preferences` | subscribers | PII | Contains category preferences |
| `click_tracking.ip_address` | click_tracking | PII | GDPR considers IPs PII in EU/UK |
| `click_tracking.user_agent` | click_tracking | PII | Can identify devices |
| `subscribers.unsubscribe_token` | subscribers | Sensitive | Authentication token |
| `subscribers.email_hash` | subscribers | PII (derived) | Keyed blind index for lookups; protected by BLIND_INDEX_KEY |

### Non-Sensitive Data (No Encryption Required)
| Data Field | Table | Reason |
|------------|-------|--------|
| `products.name` | products | Public product information |
| `products.current_price` | products | Public pricing |
| `products.image_url` | products | Public media |
| `alert_queue.old_price` | alert_queue | Transactional data |
| `alert_queue.new_price` | alert_queue | Transactional data |

---

## 2. Encryption Strategy

### Approach: Application-Level Encryption
Since Supabase provides encryption at rest, we will add an additional layer of application-level encryption for highly sensitive fields (email, push tokens).

### Encryption Method
- **Algorithm**: AES-256-GCM (WebCrypto `crypto.subtle`)
- **Key Management**: Environment variable `ENCRYPTION_KEY` (32 bytes, hex-encoded — exactly 64 hex characters)
- **IV Generation**: Random 12-byte IV per encryption operation
- **Authentication**: GCM provides built-in authentication

### Key Format and Validation
The key must be a 64-character lowercase/uppercase hex string encoding 32 raw bytes.
`isEncryptionEnabled()` returns `false` for a missing or malformed key, so values pass
through unencrypted until a valid key is configured (opt-in rollout). When a valid key is
configured, encryption/decryption failures throw `FieldEncryptionError` (fail-closed).

### Blind Index (Lookup Column)
AES-GCM uses a random IV, so encrypted values cannot be used for exact-match lookups
(unsubscribe, preference updates). The `subscribers.email_hash` column stores a keyed
HMAC-SHA256 digest of the normalized email — deterministic under the same key, unique,
and non-reversible without `BLIND_INDEX_KEY`.

- **Key**: `BLIND_INDEX_KEY` (64-char hex, separate from `ENCRYPTION_KEY`)
- **Implementation**: `packages/shared/src/utils/blindIndex.ts` — `computeBlindIndex(email)`
- **Dev fallback**: without a valid key, the hash is `lower(trim(email))` (matches the
  SQL backfill in `schema.sql`). This is not a security control; production must set
  `BLIND_INDEX_KEY`.
- **Erasure**: the unsubscribe flow re-hashes the anonymized email, so the original
  blind index can no longer locate the row.

### Wiring (Implemented)
| Path | Behavior |
|------|----------|
| `POST /api/subscribe` | encrypts email + push token, computes blind index, upserts on `email_hash` |
| `GET /api/unsubscribe` | token-verified lookup by blind index; erasure re-hashes the anonymized email and detaches `click_tracking` rows from the erased subscriber |
| `GET /api/route-link` → `POST /api/subscribe` | clicks are recorded with an `attribution_token` + HttpOnly `tb_click` cookie; subscription attributes the click to the subscriber via the cookie (no PII in URLs) |
| `GET/PATCH /api/alerts` | lookups by blind index; email/push decrypted before response |
| `sendAlertsRunner` | batch-decrypts subscriber email + push id before dispatch; undecryptable rows are isolated (channels disabled) instead of failing the run |

### Implementation
```typescript
// packages/shared/src/utils/fieldEncryption.ts + blindIndex.ts (implemented)

import { encryptField, decryptField, computeBlindIndex, getEncryptionKey } from "@thinkabell/shared";

const key = getEncryptionKey();
const emailHash = computeBlindIndex(email);      // lookup key (subscribers.email_hash)
const encrypted = await encryptField(email, key); // base64(iv || ciphertext)
const plain = await decryptField(encrypted, key);
```

Ciphertext format: `base64(iv[12] || ciphertext || authTag[16])` — a single field value,
no separators. Wrong-key or tampered ciphertext fails GCM authentication and throws.

### Key Generation
```bash
# Generate both keys (hex, 32 bytes each — they must be DIFFERENT values)
openssl rand -hex 32   # -> ENCRYPTION_KEY
openssl rand -hex 32   # -> BLIND_INDEX_KEY

# Set environment variables
export ENCRYPTION_KEY=<first_key>
export BLIND_INDEX_KEY=<second_key>
```

> **Key rotation caveat**: rotating `BLIND_INDEX_KEY` invalidates all existing
> `email_hash` values (subscribers must re-subscribe). Rotating `ENCRYPTION_KEY`
> makes stored ciphertext undecryptable (runs isolate affected subscribers).
> Schedule rotation only with a backfill/coordination plan.

---

## 3. Data Protection by Design

### Current Protections
1. **Transport Encryption**: TLS 1.2+ for all data in transit
2. **Database Encryption**: Supabase encryption at rest
3. **IP Anonymization**: Last octet masked for GDPR compliance
4. **Data Retention**: Automated deletion of old data
5. **Access Control**: RLS policies on all tables

### Additional Protections (Recommended)
1. **Field-Level Encryption**: Encrypt email and push tokens at application level
2. **Tokenization**: Replace sensitive data with tokens in logs
3. **Data Masking**: Mask sensitive data in development/staging environments
4. **Audit Logging**: Log all access to sensitive data

---

## 4. GDPR/CCPA Compliance

### Right to Access
- Provide data export in JSON format
- Include all user data from `subscribers`, `alert_queue`, `click_tracking`

### Right to Erasure
- Anonymize email: `anonymized-{uuid}@deleted.local`
- Clear preferences: `{}`
- Nullify push subscription: `null`
- Rotate unsubscribe token: `randomUUID()`
- Retain `unsubscribed_at` timestamp for compliance

### Right to Rectification
- Allow users to update preferences via `/api/subscribe`
- Verify email ownership via magic link or token

### Data Minimization
- Only collect necessary fields (email, preferences)
- Auto-delete old data via retention jobs
- Anonymize IPs before storage

---

## 5. Incident Response

### Data Breach Procedure
1. **Contain**: Disable compromised credentials, rotate secrets
2. **Assess**: Determine scope of breach (which data, how many users)
3. **Notify**: Notify affected users within 72 hours (GDPR requirement)
4. **Remediate**: Fix vulnerability, implement additional controls
5. **Document**: Record incident details and lessons learned

### Data Subject Request (DSR) Procedure
1. **Receive**: User submits access/erasure request via `/api/unsubscribe` or email
2. **Verify**: Verify user identity via email or token
3. **Process**: Export or anonymize data
4. **Respond**: Send confirmation to user within 30 days
5. **Log**: Record request and response in audit log

---

## 6. Implementation Roadmap

### Phase 1 (Current)
- [x] IP anonymization
- [x] Data retention jobs
- [x] Unsubscribe workflow
- [x] Field encryption utility (AES-256-GCM, hex key, unit-tested)
- [x] Blind index utility (HMAC-SHA256, keyed, dev fallback, unit-tested)
- [x] Wire field encryption + blind index into subscribe/unsubscribe/alerts/dispatch

### Phase 2 (Sprint 1)
- [ ] Audit logging for sensitive data access
- [ ] Data masking in development environments
- [ ] Automated secret rotation

### Phase 3 (Sprint 2)
- [ ] Tokenization for logs
- [ ] Privacy dashboard for users
- [ ] DPA automation with vendors

---

*This document is maintained by the ThinkaBell engineering team. Update quarterly.*
