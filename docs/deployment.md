# Deployment Guide

## Overview

This guide covers deploying the Nakayale VTC Management System to production using Lovable's built-in deployment features and optional CI/CD pipelines.

---

## Prerequisites

### Required Accounts
- ✅ Lovable account (project created)
- ✅ GitHub account (for version control)
- ⚠️ Custom domain (optional, requires paid Lovable plan)

### Required Setup
- ✅ Supabase project configured (automatic via Lovable Cloud)
- ✅ Environment variables set in Lovable
- ✅ All secrets configured (if using integrations)

---

## Deployment Methods

### Method 1: Lovable One-Click Deploy (Recommended)

The simplest way to deploy your VTC system.

#### Steps:
1. **Open Your Project** in Lovable
2. **Click "Publish"** button (top right on desktop, bottom right on mobile preview)
3. **Review Changes** in the deployment preview
4. **Click "Deploy"** to publish to production
5. **Access Your App** at `yourproject.lovable.app`

#### What Gets Deployed:
- ✅ All frontend code (React app)
- ✅ Supabase Edge Functions
- ✅ Database migrations (if any pending)
- ✅ Environment variables
- ✅ Static assets

#### Deployment Time:
- **First Deploy**: 2-3 minutes
- **Subsequent Deploys**: 30-60 seconds

---

### Method 2: GitHub Integration + Automatic Deploys

For teams using Git workflows and CI/CD.

#### Initial Setup:

1. **Connect GitHub**:
   ```
   Lovable Editor → GitHub button (top right) → Connect to GitHub
   ```

2. **Create Repository**:
   - Click "Create Repository"
   - Choose your GitHub account/organization
   - Repository is created with your project code

3. **Enable Auto-Deploy**:
   - Go to Project → Settings → Integrations
   - Toggle "Auto-deploy on Git push"
   - Select branch (default: `main`)

#### Workflow:

```
Local Changes → Git Push → GitHub → Auto-Deploy to Lovable
```

#### Branch Strategy:

```
main (production)
  ├─ staging (pre-production testing)
  └─ develop (active development)
      ├─ feature/trainee-enhancements
      └─ feature/new-reports
```

**Recommended Branches**:
- `main`: Production-ready code, auto-deploys
- `staging`: Testing branch, manual deploy
- `develop`: Active development, no auto-deploy
- `feature/*`: Feature branches, merge to develop

---

### Method 3: Manual GitHub Deployment

For maximum control over the deployment process.

#### Setup GitHub Actions:

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Lovable

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
      
      - name: Deploy to Lovable
        run: |
          echo "Deployment complete!"
          # Lovable handles deployment automatically via GitHub integration
```

---

## Environment Variables

### Required Variables

These are automatically set by Lovable Cloud:

```env
VITE_SUPABASE_URL=https://osiokcprjgwypmamvjhm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...
VITE_SUPABASE_PROJECT_ID=osiokcprjgwypmamvjhm
```

### Optional Variables

For external integrations, add via Lovable Settings → Secrets:

```env
# Email (if using Resend)
RESEND_API_KEY=re_xxxx

# OpenAI (if using AI features outside Lovable AI)
OPENAI_API_KEY=sk-xxxx

# Custom Analytics
GOOGLE_ANALYTICS_ID=G-XXXXXXX

# Error Tracking
SENTRY_DSN=https://xxxx@sentry.io/xxxx
```

---

## Custom Domain Setup

### Prerequisites
- Paid Lovable plan (Pro or Business)
- Domain registered (e.g., `vtc.na` or `vtchub.com`)

### Steps:

1. **Open Domain Settings**:
   ```
   Project → Settings → Domains → Add Custom Domain
   ```

2. **Enter Your Domain**:
   - Primary domain: `vtc.na`
   - Or subdomain: `app.vtc.na`

3. **Configure DNS Records**:
   
   Add these records to your domain provider (Namecheap, GoDaddy, etc.):

   **For Root Domain** (`vtc.na`):
   ```
   Type: A
   Name: @
   Value: [IP provided by Lovable]
   TTL: 300
   ```

   **For Subdomain** (`app.vtc.na`):
   ```
   Type: CNAME
   Name: app
   Value: [hostname provided by Lovable]
   TTL: 300
   ```

4. **Verify Domain**:
   - Click "Verify" in Lovable
   - Wait for DNS propagation (5-60 minutes)
   - SSL certificate auto-issued (Let's Encrypt)

5. **Set as Primary** (optional):
   - Makes custom domain the default
   - Redirects `*.lovable.app` to your domain

---

## Database Migrations

### Automatic Migrations

Lovable Cloud handles migrations automatically:
1. Migration files in `supabase/migrations/` detected
2. Migrations run during deployment
3. Database schema updated automatically

### Manual Migration (if needed)

If you need to run a migration manually:

1. **Via Lovable Dashboard**:
   - Settings → Backend → Run Migrations

2. **Via Supabase SQL Editor** (for complex migrations):
   - Open Lovable → Backend button
   - Navigate to SQL Editor
   - Paste and run migration SQL

### Migration Best Practices:
- ✅ Always backup before major migrations
- ✅ Test migrations on staging first
- ✅ Use transactions for safety
- ✅ Document migrations in changelog
- ❌ Never delete old migrations
- ❌ Don't edit applied migrations

---

## Supabase Edge Functions Deployment

### Automatic Deployment

Edge functions deploy automatically with your code:
- All functions in `supabase/functions/` included
- Environment variables (secrets) available
- CORS headers configured
- JWT verification on by default

### Manual Function Deployment

To deploy edge functions independently:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref osiokcprjgwypmamvjhm

# Deploy specific function
supabase functions deploy subscription-monitor

# Deploy all functions
supabase functions deploy
```

### Function Configuration

Edit `supabase/config.toml` to configure functions:

```toml
[functions.subscription-monitor]
verify_jwt = true  # Require authentication

[functions.api-gateway]
verify_jwt = true

[functions.scheduled-reports]
verify_jwt = false  # Allow CRON to call without JWT
```

---

## CRON Job Setup

### Enable Extensions

Run once in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Schedule Subscription Monitor (Daily at 2 AM)

```sql
SELECT cron.schedule(
  'subscription-monitoring-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://osiokcprjgwypmamvjhm.supabase.co/functions/v1/subscription-monitor',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) as request_id;
  $$
);
```

### Schedule Weekly Reports (Sundays at 8 AM)

```sql
SELECT cron.schedule(
  'weekly-reports',
  '0 8 * * 0',
  $$
  SELECT net.http_post(
    url:='https://osiokcprjgwypmamvjhm.supabase.co/functions/v1/scheduled-reports',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) as request_id;
  $$
);
```

### View Scheduled Jobs

```sql
SELECT * FROM cron.job;
```

### Delete a Job (if needed)

```sql
SELECT cron.unschedule('job-name-here');
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`npm test`)
- [ ] No console errors in staging
- [ ] Database migrations tested
- [ ] Secrets configured
- [ ] Performance acceptable (<2s load times)
- [ ] Security scan clean (no critical issues)
- [ ] Changelog updated
- [ ] Team notified of deployment

### Deployment

- [ ] Create backup of production database
- [ ] Deploy to staging first (if separate environment)
- [ ] Run smoke tests on staging
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Check edge functions deployed
- [ ] Test critical user workflows

### Post-Deployment

- [ ] Monitor logs for errors (first 30 minutes)
- [ ] Test key features in production
- [ ] Verify CRON jobs running (check logs next day)
- [ ] Check performance metrics
- [ ] Update documentation if needed
- [ ] Notify team of successful deployment
- [ ] Mark deployment in changelog

---

## Rollback Procedure

If deployment causes issues:

### Quick Rollback (Lovable)

1. **Go to Project History**:
   - Click project name → Version History
   
2. **Find Last Working Version**:
   - Identify version before problematic deployment
   
3. **Revert**:
   - Click "Revert to this version"
   - Confirm reversion
   
4. **Re-deploy**:
   - Click "Publish" to deploy reverted version

### Database Rollback

If database changes need reverting:

1. **Restore from Backup**:
   - Backend → Backups → Restore specific backup
   
2. **Manual SQL Revert** (if migrations need undoing):
   ```sql
   -- Revert specific migration (example)
   DROP INDEX IF EXISTS idx_trainees_search;
   DROP FUNCTION IF EXISTS global_search;
   ```

3. **Verify Data Integrity**:
   - Run queries to check data consistency
   - Test critical workflows

---

## Monitoring & Observability

### Application Monitoring

**Lovable Built-in**:
- Deployment logs
- Edge function logs
- Error tracking

**External Tools** (optional):
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **New Relic**: APM

### Database Monitoring

**Supabase Dashboard**:
- Query performance
- Connection pooling
- Database size
- API request logs

### Uptime Monitoring

Recommended services:
- **Pingdom**: HTTP monitoring
- **UptimeRobot**: Free uptime checks
- **StatusCake**: Status page

---

## Performance Optimization

### Frontend

```javascript
// Enable code splitting
import { lazy, Suspense } from 'react';

const Reports = lazy(() => import('./pages/Reports'));

<Suspense fallback={<div>Loading...</div>}>
  <Reports />
</Suspense>
```

### Database

```sql
-- Add indexes for slow queries
CREATE INDEX CONCURRENTLY idx_slow_query 
ON table_name(column_name);

-- Analyze query plans
EXPLAIN ANALYZE 
SELECT * FROM trainees WHERE organization_id = 'xxx';
```

### Caching Strategy

```typescript
// Cache dashboard stats for 5 minutes
export const useDashboardStats = () => {
  return useQuery({
    queryKey: ["dashboard_stats"],
    queryFn: fetchStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

---

## Security Considerations

### SSL/TLS
- ✅ Automatic SSL via Lovable
- ✅ HTTPS enforced on all domains
- ✅ HSTS headers enabled

### Content Security Policy

Add to `index.html`:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
               style-src 'self' 'unsafe-inline';">
```

### Environment Variables
- ❌ Never commit `.env` files
- ✅ Use Lovable Secrets Manager
- ✅ Rotate secrets regularly
- ✅ Limit access to sensitive variables

---

## Backup & Disaster Recovery

### Automated Backups

Supabase automatically backs up:
- **Daily**: Full database backup (retained 7 days)
- **Weekly**: Full backup (retained 4 weeks)
- **Point-in-time**: Recovery to any point in last 7 days

### Manual Backups

Via Supabase Dashboard:
1. Backend → Database → Backups
2. Click "Create Backup"
3. Name backup (e.g., "pre-migration-2025-11-03")
4. Download if needed for local storage

### Organization-Specific Backups

Use the `backup-organization-data` edge function:

```typescript
const response = await supabase.functions.invoke('backup-organization-data', {
  body: { organization_id: 'org-uuid' }
});
```

### Disaster Recovery Plan

1. **Identify Issue**: Determine scope of data loss
2. **Stop Operations**: Prevent further damage
3. **Restore Backup**: Use most recent clean backup
4. **Verify Data**: Check data integrity
5. **Resume Operations**: Inform users
6. **Post-Mortem**: Document and prevent recurrence

---

## CI/CD Pipeline (Advanced)

### GitHub Actions Example

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint
      
  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Staging
        run: echo "Deploy to staging environment"
        
  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Production
        run: echo "Deploy to production (automatic via Lovable)"
      - name: Notify team
        run: echo "Send Slack notification"
```

---

## Troubleshooting

### Deployment Fails

**Issue**: "Build failed" error

**Solutions**:
1. Check build logs in Lovable
2. Verify all dependencies in `package.json`
3. Test build locally: `npm run build`
4. Check for TypeScript errors

---

**Issue**: Edge functions not deploying

**Solutions**:
1. Check `supabase/config.toml` syntax
2. Verify function code has no syntax errors
3. Check edge function logs in Backend
4. Ensure `Deno.serve()` is used correctly

---

**Issue**: Database migration stuck

**Solutions**:
1. Check migration SQL syntax
2. Ensure no conflicting migrations
3. Check database logs in Supabase
4. Manually apply migration if safe

---

### Production Issues

**Issue**: Slow performance after deploy

**Solutions**:
1. Check database query performance
2. Verify indexes are created
3. Check for N+1 query problems
4. Review edge function logs for timeouts

---

**Issue**: Users can't login

**Solutions**:
1. Verify Supabase Auth is enabled
2. Check RLS policies on profiles table
3. Verify environment variables set
4. Check browser console for errors

---

## Support & Resources

### Official Documentation
- [Lovable Docs](https://docs.lovable.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [React Query Docs](https://tanstack.com/query/latest)

### Getting Help
- Lovable Discord: Community support
- GitHub Issues: Bug reports and features
- Team Chat: Internal support channel

### Escalation
1. Check documentation first
2. Search existing GitHub issues
3. Ask in Lovable Discord
4. Create new GitHub issue if needed
5. Contact Lead Developer for critical issues

---

**Last Updated**: 2025-11-03  
**Maintained By**: Lead Developer  
**Next Review**: 2026-01-03
