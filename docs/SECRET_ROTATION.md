# ThinkaBell Secret Rotation Workflow

This document defines the secret rotation procedure for all sensitive credentials in the ThinkaBell platform.

---

## 1. Secrets Inventory

### Application Secrets
| Secret | Location | Rotation Frequency | Owner |
|--------|----------|-------------------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel/Hostinger env | Quarterly | Backend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel/Hostinger env | Quarterly | Backend |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel/Hostinger env | Quarterly | Backend |
| `ALERTS_API_KEY` | Vercel/Hostinger env | Monthly | Backend |
| `CRON_SECRET` | Vercel/Hostinger env | Monthly | Backend |
| `ONESIGNAL_REST_API_KEY` | Vercel/Hostinger env | Quarterly | Backend |
| `BREVO_API_KEY` | Vercel/Hostinger env | Quarterly | Backend |
| `AMAZON_CLIENT_SECRET` | Vercel/Hostinger env | Quarterly | Backend |
| `EBAY_CLIENT_SECRET` | Vercel/Hostinger env | Quarterly | Backend |
| `WALMART_API_KEY` | Vercel/Hostinger env | Quarterly | Backend |
| `PARTNERSTACK_API_KEY` | Vercel/Hostinger env | Quarterly | Backend |
| `APPSUMO_API_KEY` | Vercel/Hostinger env | Quarterly | Backend |
| `IMPACT_API_KEY` | Vercel/Hostinger env | Quarterly | Backend |

### Infrastructure Secrets
| Secret | Location | Rotation Frequency | Owner |
|--------|----------|-------------------|-------|
| `SUPABASE_DB_PASSWORD` | Supabase Dashboard | Quarterly | Backend |
| `SENTRY_DSN` | Vercel/Hostinger env | Quarterly | Frontend |
| `POSTHOG_API_KEY` | Vercel/Hostinger env | Quarterly | Frontend |

---

## 2. Rotation Procedure

### Prerequisites
1. Access to Vercel/Hostinger dashboard
2. Access to Supabase dashboard
3. Access to Upstash dashboard
4. Access to Brevo dashboard
5. Access to OneSignal dashboard
6. Access to Amazon/PartnerStack/AppSumo/Impact dashboards
7. Access to GitHub repository secrets

### Step-by-Step Rotation

#### 2.1 Generate New Secret
1. Log into the respective service dashboard
2. Navigate to API keys/secrets section
3. Generate new secret/key
4. Copy new secret to secure password manager

#### 2.2 Update CI/CD Secrets
1. Navigate to GitHub repository Settings > Secrets and variables > Actions
2. Update the secret with the new value
3. Verify secret is updated (value will be masked)

#### 2.3 Update Deployment Environment
**For Vercel:**
```bash
vercel secrets add <secret_name> <new_value>
vercel secrets rm <old_secret_name>  # if renaming
vercel env add <secret_name> production <new_value>
vercel env add <secret_name> preview <new_value>
```

**For Hostinger:**
1. Log into hPanel
2. Navigate to Node.js app
3. Update environment variable in dashboard
4. Save and restart application

#### 2.4 Verify Deployment
1. Trigger deployment (push commit or manual deploy)
2. Verify application starts successfully
3. Run smoke tests:
   ```bash
   curl -f https://thinkabell.click/api/health
   curl -f https://thinkabell.click/api/cron/fetch-prices -H "Authorization: Bearer $CRON_SECRET" -X POST -d ''
   ```

#### 2.5 Revoke Old Secret
1. Return to service dashboard
2. Revoke/delete old secret
3. Confirm old secret no longer works

#### 2.6 Document Rotation
1. Update this document with rotation date
2. Record new secret expiry date in password manager
3. Set calendar reminder for next rotation

---

## 3. Emergency Rotation

### When to Rotate Immediately
- Suspected secret compromise
- Team member departure with secret access
- Secret accidentally committed to Git
- Security incident or breach

### Emergency Procedure
1. Generate new secret immediately
2. Update CI/CD secrets (GitHub, Vercel/Hostinger)
3. Deploy immediately (skip normal queue if possible)
4. Revoke old secret
5. Audit access logs for unauthorized usage
6. Document incident and rotation

---

## 4. Secret Storage Best Practices

### Do's
- Store secrets in environment variables only
- Use password manager for secret generation tracking
- Encrypt secrets at rest (Vercel/Hostinger do this automatically)
- Use different secrets for staging and production
- Limit secret access to need-to-know basis

### Don'ts
- Never commit secrets to Git
- Never share secrets via email/Slack
- Never log secrets in application logs
- Never hardcode secrets in source code
- Never reuse secrets across services

---

## 5. Automated Rotation

### Recommended Tools
- **Vercel**: Built-in secret management with CLI
- **Hostinger**: Environment variables in hPanel
- **GitHub**: Encrypted secrets with access logging
- **Supabase**: Database password rotation in dashboard
- **Upstash**: Token regeneration in dashboard

### Rotation Schedule
Set calendar reminders for:
- Monthly: `ALERTS_API_KEY`, `CRON_SECRET`
- Quarterly: All other secrets
- Annual: Full security audit and secret review

---

*This document is maintained by the ThinkaBell engineering team. Update quarterly.*
