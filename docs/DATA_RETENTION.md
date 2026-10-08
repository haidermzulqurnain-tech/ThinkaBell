# Data Retention Policy

## Overview
This document outlines the data retention schedule for the ThinkaBell platform.

## Retention Periods

| Data Type | Retention Period | Reason |
|-----------|-----------------|--------|
| User accounts (subscribers) | Active + 30 days | Service provision and legal compliance |
| Price history | 2 years | Analytics and trend analysis |
| Alert queue | 30 days | Delivery attempts and deduplication |
| Click tracking | 1 year | Affiliate attribution and analytics |
| Dead letter queue | 90 days | Debugging and audit trail |
| Logs | 30 days | Operational debugging |

## Data Deletion

Users may request data deletion by:
1. Using the unsubscribe link in any email
2. Contacting privacy@thinkabell.click
3. Using the account deletion feature (if available)

Deletion requests are processed within 30 days.

## Automated Cleanup

The following automated cleanup jobs run via Supabase pg_cron:

```sql
-- Archive old price history (run monthly)
SELECT archive_old_price_history();

-- Archive old click tracking (run monthly)
SELECT archive_old_clicks();
```

## Compliance

This retention schedule complies with:
- GDPR Article 5 (storage limitation)
- CCPA/CPRA data retention requirements
- Affiliate program terms of service

## Review Schedule

This policy is reviewed annually and updated as needed.
