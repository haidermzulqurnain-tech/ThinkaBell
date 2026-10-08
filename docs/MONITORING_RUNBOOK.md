# ThinkaBell Monitoring & Alerting Runbook

This runbook defines the monitoring strategy, alert thresholds, and incident response procedures for **thinkabell.click**.

---

## 1. Health Checks

### Endpoints
- `GET /api/health` — Returns DB + Redis connectivity status
- `GET /api/health?detailed=true` — Returns detailed component health

### Monitoring
- **Tool**: UptimeRobot, Pingdom, or Cloudflare Health Check
- **Frequency**: Every 5 minutes
- **Timeout**: 10 seconds
- **Alert Channels**: Email, SMS, Slack
- **Escalation**: Page on-call engineer after 2 consecutive failures

---

## 2. Job Monitoring

### Job Runs Table
Monitor `job_runs` table for:
- **Failed executions**: `status = 'failed'`
- **Partial executions**: `status = 'partial'`
- **Stale runs**: `started_at > NOW() - INTERVAL '2 hours'` for 6-hour cron jobs
- **High error rates**: `error_rate > 10%` over last 24 hours

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Job failure rate | >5% in 1 hour | >10% in 1 hour |
| Job duration | >2x normal | >5x normal |
| Dead letter queue size | >100 | >500 |
| Alert queue depth | >1000 | >5000 |
| Price fetch failures | >10% of products | >25% of products |

### Response
1. Check `job_runs` table for recent failures
2. Review application logs in Vercel/Hostinger dashboard
3. Verify external API status pages (eBay, Walmart, PartnerStack, AppSumo, Impact)
4. Check Redis connectivity (`redis-cli ping`)
5. Review Supabase dashboard for database errors

---

## 3. Application Metrics

### Key Metrics to Monitor
- **Request rate**: Requests per minute by endpoint
- **Error rate**: 4xx/5xx responses by endpoint
- **Latency**: p50, p95, p99 response times
- **Database connections**: Active connections in Supabase pool
- **Redis memory**: Memory usage and eviction rate
- **Queue depth**: `alert_queue` pending count

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| 5xx error rate | >1% in 5 minutes | >5% in 5 minutes |
| p95 latency | >2s | >5s |
| DB connections | >80% of pool | >95% of pool |
| Redis memory | >80% | >95% |
| Alert queue depth | >1000 | >5000 |

---

## 4. External API Monitoring

### Monitored APIs
- **eBay Browse API**: Token acquisition, item search, item details
- **Walmart API**: Item search, item details
- **PartnerStack API**: Product search
- **AppSumo API**: Deal search
- **Impact API**: Offer search

### Circuit Breaker States
Monitor circuit breaker states in Redis:
- `circuit:ebay` — eBay circuit state
- `circuit:walmart` — Walmart circuit state
- `circuit:partnerstack` — PartnerStack circuit state
- `circuit:appsumo` — AppSumo circuit state
- `circuit:impact` — Impact circuit state

### Alert Thresholds
| Circuit State | Action |
|---------------|--------|
| `open` | Alert immediately — all requests failing |
| `half-open` | Monitor closely — recovery in progress |
| `closed` | No action |

---

## 5. Infrastructure Monitoring

### Supabase
- **Database size**: Alert at 80% of 500MB free tier
- **Connection count**: Alert at >80% of pool
- **Query latency**: Alert at p95 >1s
- **Storage**: Daily backup verification

### Redis (Upstash)
- **Memory usage**: Alert at >80% of 1GB
- **Command rate**: Alert at >8,000 commands/day (free tier)
- **Evictions**: Alert if keys being evicted

### Hostinger
- **CPU usage**: Alert at >80% for 5 minutes
- **RAM usage**: Alert at >80% for 5 minutes
- **Disk usage**: Alert at >80%
- **Response time**: Alert at >3s

### Brevo (Email)
- **Daily sent count**: Alert at >250 emails/day (free tier limit: 300)
- **Bounce rate**: Alert at >5%
- **Spam complaints**: Alert at >1%

---

## 6. Incident Response

### Severity Levels
| Severity | Definition | Response Time | Examples |
|----------|-----------|---------------|----------|
| P0 | Complete outage | 15 minutes | Site down, DB unavailable |
| P1 | Major degradation | 1 hour | Alerts not sending, search broken |
| P2 | Minor issue | 4 hours | Single API failing, UI bug |
| P3 | Enhancement | Next sprint | Feature request |

### Incident Response Steps
1. **Acknowledge**: Assign incident in monitoring tool
2. **Assess**: Check health endpoints, job runs, and logs
3. **Mitigate**: Roll back deployment, disable failing component, or switch to fallback
4. **Communicate**: Update status page if applicable
5. **Resolve**: Deploy fix
6. **Post-mortem**: Document root cause and preventive actions

### Rollback Procedure
```bash
# Vercel
vercel rollback [deployment-url]

# Hostinger
# Replace current build with previous dist/hostinger-deploy/ backup
```

---

## 7. Backup & Disaster Recovery

### Database Backups
- **Frequency**: Daily at 2:00 AM UTC
- **Retention**: 30 days
- **Storage**: Separate from production (local + cloud)
- **Verification**: Weekly restore test

### Backup Script
```bash
pnpm tsx scripts/backup-db.ts
```

### RPO/RTO Targets
| Scenario | RPO (Recovery Point Objective) | RTO (Recovery Time Objective) |
|----------|-------------------------------|-------------------------------|
| Database loss | 24 hours | 4 hours |
| Application failure | 0 (instant rollback) | 15 minutes |
| Data corruption | 24 hours | 2 hours |
| Complete infrastructure loss | 24 hours | 8 hours |

### Restoration Procedure
1. Create new Supabase project
2. Run `schema.sql` to create tables
3. Restore from latest backup: `psql $SUPABASE_DB_CONNECTION_STRING < backup.sql`
4. Verify data integrity
5. Update DNS if needed

---

## 8. Cost Monitoring

### Monthly Budget Alerts
- **Supabase**: Alert at $450 (Pro plan)
- **Upstash Redis**: Alert at $10 (Pro plan)
- **Brevo**: Alert at $25 (Essentials plan)
- **Hostinger**: Alert at $15 (overage charges)
- **OneSignal**: Alert at 9,000 subscribers (free tier limit)

### Cost Optimization
- Review Redis usage weekly; delete unused keys
- Review Brevo contact lists monthly; prune inactive subscribers
- Review Supabase storage monthly; archive old data
- Review Hostinger CPU/RAM usage; upgrade plan if throttling

---

## 9. Compliance Monitoring

### GDPR/CCPA
- Monitor unsubscribe requests daily
- Verify data retention jobs run successfully
- Review data access logs monthly
- Conduct annual privacy audit

### Affiliate Compliance
- Verify `rel="sponsored"` on all affiliate links (automated CI check)
- Verify FTC disclosure on all deal pages (automated CI check)
- Review ToS quarterly for network-specific requirements

### Security
- Rotate secrets quarterly
- Review access logs monthly
- Conduct annual penetration test
- Monitor CVE advisories for dependencies (`pnpm audit`)

---

## 10. On-Call Runbook

### Quick Commands
```bash
# Check job runs
psql $SUPABASE_DB_CONNECTION_STRING -c "SELECT * FROM job_runs ORDER BY started_at DESC LIMIT 20;"

# Check alert queue depth
psql $SUPABASE_DB_CONNECTION_STRING -c "SELECT COUNT(*) FROM alert_queue WHERE sent = FALSE;"

# Check dead letter queue
psql $SUPABASE_DB_CONNECTION_STRING -c "SELECT COUNT(*) FROM alert_dead_letter;"

# Check Redis connectivity
redis-cli ping

# Check circuit breaker states
redis-cli GET circuit:ebay
redis-cli GET circuit:walmart

# Run health check
curl https://thinkabell.click/api/health

# View application logs
vercel logs thinkabell.click --since 1h
```

### Escalation Contacts
- **Primary**: Engineering team lead
- **Secondary**: CTO
- **Vendor Support**: 
  - Supabase: support@supabase.com
  - Upstash: support@upstash.com
  - Brevo: support@brevo.com

---

*This runbook is maintained by the ThinkaBell engineering team. Update quarterly.*
