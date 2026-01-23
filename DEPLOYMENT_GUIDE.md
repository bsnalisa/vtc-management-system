# VTC Management System - Production Deployment Guide

## Overview

This guide covers deploying the VTC Management System to production with:
- Frontend hosted on Vercel
- Backend (Edge Functions) on Lovable Cloud/Supabase
- CI/CD via GitHub Actions
- Custom subdomain routing for each organization
- Automated document generation

## Prerequisites

1. **GitHub Account** with repository access
2. **Vercel Account** (free tier sufficient for start)
3. **Lovable Cloud** with Supabase project (already configured)
4. **Domain Name** (e.g., nvtc.app) for subdomain routing

## Step 1: GitHub Setup

### 1.1 Connect GitHub to Lovable
1. In Lovable, click **GitHub → Connect to GitHub**
2. Authorize the Lovable GitHub App
3. Click **Create Repository** to push your code to GitHub

### 1.2 Repository Secrets
Add these secrets to your GitHub repository:
- Go to **Settings → Secrets and variables → Actions**
- Click **New repository secret** for each:

```yaml
VERCEL_TOKEN: <your-vercel-token>
VERCEL_ORG_ID: <your-vercel-org-id>
VERCEL_PROJECT_ID: <your-vercel-project-id>
VITE_SUPABASE_URL: https://osiokcprjgwypmamvjhm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY: <your-anon-key>
VITE_SUPABASE_PROJECT_ID: osiokcprjgwypmamvjhm
SUPABASE_ACCESS_TOKEN: <your-supabase-access-token>
SUPABASE_PROJECT_REF: osiokcprjgwypmamvjhm
```

## Step 2: Vercel Setup

### 2.1 Create Vercel Project
1. Go to [vercel.com](https://vercel.com)
2. Click **Add New → Project**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2.2 Environment Variables in Vercel
Add these in Vercel Project Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://osiokcprjgwypmamvjhm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
VITE_SUPABASE_PROJECT_ID=osiokcprjgwypmamvjhm
```

### 2.3 Get Vercel IDs
Run these commands to get your IDs:
```bash
# Install Vercel CLI
npm i -g vercel

# Login and link project
vercel login
vercel link

# Get project info
vercel project ls
```

Add the returned IDs to GitHub secrets.

## Step 3: Subdomain Routing Setup

### 3.1 Domain Configuration
1. Purchase domain `nvtc.app` (or your preferred domain)
2. Add to Vercel:
   - Vercel Dashboard → Your Project → Settings → Domains
   - Add domain: `nvtc.app`
   - Add wildcard: `*.nvtc.app`

### 3.2 DNS Records
Add these DNS records at your domain registrar:

**For Root Domain:**
```
Type: A
Name: @
Value: 76.76.21.21 (Vercel IP)
```

**For Wildcard Subdomains:**
```
Type: CNAME
Name: *
Value: cname.vercel-dns.com
```

**Verification TXT Record:**
```
Type: TXT
Name: _vercel
Value: <provided-by-vercel>
```

### 3.3 Subdomain Resolution Logic
Update your routing to handle subdomains:

```typescript
// Add to src/lib/subdomainRouter.ts
export function getOrganizationFromSubdomain(): string | null {
  const hostname = window.location.hostname;
  
  // Development
  if (hostname === 'localhost' || hostname.includes('lovable.app')) {
    return null;
  }
  
  // Production subdomains
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    // Extract subdomain (e.g., 'nairobi' from 'nairobi.nvtc.app')
    return parts[0];
  }
  
  return null;
}
```

## Step 4: CI/CD Pipeline

### 4.1 GitHub Actions Workflows
Two workflows are included:

**deploy.yml** - Runs on push to main:
1. Builds the project
2. Deploys to Vercel
3. Deploys Edge Functions to Supabase

**test.yml** - Runs on pull requests:
1. Type checking
2. Linting
3. Build verification

### 4.2 Triggering Deployments

**Automatic:**
- Push to `main` branch triggers full deployment
- Pull requests trigger tests only

**Manual:**
```bash
# Trigger via GitHub UI
# Go to Actions → Deploy to Production → Run workflow
```

## Step 5: Edge Functions Deployment

Edge functions are auto-deployed via GitHub Actions, but you can also deploy manually:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref osiokcprjgwypmamvjhm

# Deploy all functions
supabase functions deploy backup-organization-data
supabase functions deploy expire-trials-and-notify
supabase functions deploy generate-pdf-document
```

## Step 6: Post-Deployment Configuration

### 6.1 Set Up Cron Jobs
Already configured, but verify in Supabase:
```sql
SELECT * FROM cron.job;
```

### 6.2 Storage Buckets
Verify buckets exist:
- `avatars` (public) - Organization logos
- `documents` (private) - Generated PDFs
- `organization-backups` (private) - Data backups

### 6.3 Test Organization Setup
1. Navigate to production URL
2. Access setup wizard: `/setup`
3. Create test organization
4. Verify subdomain works: `{org-name}.nvtc.app`

## Step 7: Monitoring & Maintenance

### 7.1 Monitoring Tools
- **Vercel Analytics**: Built-in performance monitoring
- **Supabase Dashboard**: Edge function logs, database metrics
- **GitHub Actions**: CI/CD pipeline status

### 7.2 Log Access

**Frontend Logs (Vercel):**
- Vercel Dashboard → Your Project → Logs

**Edge Function Logs:**
- Lovable Cloud → Backend → Edge Functions → Select function
- Or via CLI: `supabase functions logs generate-pdf-document`

**Database Logs:**
Use the Lovable Cloud backend analytics or run:
```sql
SELECT * FROM postgres_logs 
ORDER BY timestamp DESC 
LIMIT 100;
```

### 7.3 Backup Verification
Check weekly backups:
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'weekly-organization-backup')
ORDER BY start_time DESC;
```

## Step 8: Custom Domain Per Organization

### 8.1 Enable Custom Domains
Organizations can use custom domains instead of subdomains:

1. Organization admin adds custom domain in settings
2. System provides DNS records to configure
3. Vercel automatically provisions SSL

**Implementation:**
```typescript
// In organization settings
const { data: settings } = await supabase
  .from("organization_settings")
  .update({ domain: "customvtc.com" })
  .eq("organization_id", orgId);
```

### 8.2 Domain Verification
Add verification logic:
```typescript
// Verify domain ownership via TXT record
const verifyDomain = async (domain: string) => {
  const txt = await dns.resolveTxt(`_vtc-verify.${domain}`);
  return txt.includes(orgId);
};
```

## Troubleshooting

### Deployment Fails
1. Check GitHub Actions logs
2. Verify all secrets are set correctly
3. Ensure build command succeeds locally: `npm run build`

### Subdomain Not Resolving
1. Verify DNS propagation: [dnschecker.org](https://dnschecker.org)
2. Check wildcard CNAME record
3. Wait up to 48 hours for full DNS propagation

### Edge Functions Not Working
1. Check function is deployed: `supabase functions list`
2. View logs: `supabase functions logs <function-name>`
3. Test locally: `supabase functions serve <function-name>`

### PDF Generation Fails
1. Check edge function logs for errors
2. Verify storage bucket permissions
3. Ensure user has proper role permissions

### Storage Access Denied
1. Review RLS policies on storage.objects
2. Verify organization_id matches folder structure
3. Check user authentication status

## Security Checklist

- [x] Environment variables stored securely (not in code)
- [x] RLS policies enabled on all tables
- [x] Storage buckets have proper RLS
- [x] Edge functions validate authentication
- [x] CORS configured correctly
- [x] Database functions use SECURITY DEFINER
- [x] Subdomain isolation enforced
- [ ] Enable password leak protection
- [ ] Configure rate limiting on API routes
- [ ] Set up monitoring alerts
- [ ] Regular security audits scheduled

## Production URLs

- **Main App**: https://nvtc.app
- **Setup Wizard**: https://nvtc.app/setup
- **Organization Example**: https://nairobi.nvtc.app
- **Admin Portal**: https://nvtc.app/super-admin

## Support & Documentation

- **Full Documentation**: See `PACKAGE_BILLING_ENGINE.md`, `PHASE_1_IMPLEMENTATION.md`
- **Backup Guide**: `BACKUP_SETUP.md`
- **Setup Guide**: `SETUP_COMPLETE.md`
- **GitHub Repository**: [Your GitHub URL]
- **Lovable Cloud**: https://lovable.dev

---

**Deployment Status**: Ready for Production
**Last Updated**: 2025-11-03
**Version**: 1.0.0
