# Organization Data Backup Setup

This document explains how to set up automated weekly backups for organization data.

## Overview

The system includes an edge function `backup-organization-data` that:
- Runs weekly via a Supabase cron job
- Exports all organization data (trainees, trainers, classes, fees, attendance)
- Stores backups in the `organization-backups` storage bucket
- Organizes backups by organization ID and date

## Setup Instructions

### 1. Enable Required Extensions

First, enable the required PostgreSQL extensions in your Lovable Cloud backend:

```sql
-- Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Schedule the Backup Job

Create a weekly cron job that runs every Sunday at 2 AM:

```sql
SELECT cron.schedule(
  'weekly-organization-backup',
  '0 2 * * 0', -- Every Sunday at 2:00 AM
  $$
  SELECT net.http_post(
    url := 'https://osiokcprjgwypmamvjhm.supabase.co/functions/v1/backup-organization-data',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zaW9rY3Byamd3eXBtYW12amhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMDE0NDEsImV4cCI6MjA3NTU3NzQ0MX0.eNHCZqZmXDpcAqYXHLwFgObYADT4XPecnCqhrI3NAFI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### 3. Verify the Schedule

Check that the cron job is active:

```sql
SELECT * FROM cron.job WHERE jobname = 'weekly-organization-backup';
```

### 4. Manual Backup Trigger

You can manually trigger a backup anytime by calling the edge function directly or using the Lovable Cloud interface.

## Backup Structure

Backups are stored with the following structure:

```
organization-backups/
├── {org-id-1}/
│   ├── 2025-11-03_backup.json
│   ├── 2025-11-10_backup.json
│   └── ...
├── {org-id-2}/
│   ├── 2025-11-03_backup.json
│   └── ...
```

Each backup file contains:
- Organization metadata
- Timestamp
- Complete data for:
  - Trainees
  - Trainers
  - Classes
  - Fee records
  - Attendance registers

## Access Control

- Super admins can access all backups
- Organization admins can only access their organization's backups
- Backups are stored in a private bucket (not publicly accessible)

## Monitoring

To check recent backup status:
1. View edge function logs in Lovable Cloud
2. Check the storage bucket for recent files
3. Review cron job execution history

## Troubleshooting

If backups are not running:
1. Verify the cron job is active: `SELECT * FROM cron.job`
2. Check edge function logs for errors
3. Ensure the storage bucket exists and has correct policies
4. Verify the edge function is deployed

## Retention Policy

Consider implementing a retention policy to automatically delete old backups:

```sql
-- Example: Delete backups older than 90 days (implement as needed)
-- This would require a separate cleanup function
```
