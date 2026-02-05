
# Comprehensive Workflow Refactoring Plan

## Executive Summary

This plan addresses critical architectural issues in the trainee application and registration workflows. The current implementation has tightly coupled logic, race conditions in account provisioning, and premature side effects during application submission. This refactoring will create a production-ready, fault-tolerant, state-driven system.

---

## Current State Analysis

### Identified Issues

1. **Premature Account Provisioning**: Trainee auth accounts are created during screening (when marked "provisionally qualified"), before payment clearance
2. **Missing Financial Queue**: No `financial_queue` table exists - payments are handled directly through `payment_clearances`
3. **Tightly Coupled Logic**: Frontend hooks trigger side effects that should be atomic backend operations
4. **Race Conditions**: The current provisioning flow has a `setTimeout(800ms)` to wait for triggers - unreliable
5. **Dashboard Data Issues**: Dashboards derive status from multiple inconsistent sources
6. **Trainee Portal Uses Mock Data**: `TraineeAdmissionStatusPage.tsx` and `TraineeDashboard.tsx` use hardcoded sample data

### Existing Infrastructure (Preserved)

- `account_provisioning_status` enum: `not_started`, `auto_provisioned`, `manually_provisioned`, `failed`
- `provisioning_logs` table for audit trails
- `payment_clearances` table with `status`: pending, partial, cleared
- `provision-trainee-auth` Edge Function (needs hardening)
- `registration_status` constraint: applied, pending_payment, provisionally_admitted, payment_verified, payment_cleared, fully_registered, registered

---

## Proposed Architecture

### Status Machine (Single Source of Truth)

```text
TRAINEE APPLICATION LIFECYCLE

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  APPLICATION                    FINANCIAL CLEARANCE           REGISTRATION     │
│  ──────────                     ─────────────────────         ────────────     │
│                                                                                 │
│  [SUBMIT]                                                                       │
│     │                                                                           │
│     ▼                                                                           │
│  ┌───────────┐                                                                 │
│  │  applied  │  ←── Initial state on submission                                │
│  └───────────┘                                                                 │
│     │                                                                           │
│     │ Screen (Reg Officer)                                                     │
│     ▼                                                                           │
│  ┌───────────────────────┐                                                     │
│  │ provisionally_admitted │  ←── Qualified, awaiting payment                   │
│  └───────────────────────┘                                                     │
│     │                           ┌─────────────────────┐                        │
│     │ ── OR ──                  │                     │                        │
│     ▼                           ▼                     │                        │
│  ┌────────────────┐        ┌──────────────┐          │                        │
│  │ does_not_qualify│        │pending_payment│ ←─────┐  │                        │
│  └────────────────┘        └──────────────┘         │  │                        │
│     (End state)                  │                   │  │                        │
│                                  │ Payment cleared   │  │                        │
│                                  ▼                   │  │                        │
│                             ┌────────────────┐      │  │                        │
│                             │payment_cleared │ ──────┼──┼── TRIGGER: Provision   │
│                             └────────────────┘      │  │   Auth Account Here!   │
│                                  │                   │  │                        │
│                                  │ Finalise (Reg)    │  │                        │
│                                  ▼                   │  │                        │
│                             ┌────────────┐          │  │                        │
│                             │ registered │ ─────────┴──┴── Trainee Created     │
│                             └────────────┘                                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Core Design Principles

| Principle | Implementation |
|-----------|----------------|
| No side effects on submission | Application capture only saves data, status = `applied` |
| Financial clearance triggers identity | Account provisioning occurs ONLY after `payment_cleared` |
| One Edge Function per action | Four atomic functions with transactions |
| State-driven dashboards | All queries filter by explicit status fields |
| Idempotent operations | System email as idempotency key for auth accounts |

---

## Database Schema Changes

### 1. New `financial_queue` Table

```sql
CREATE TABLE public.financial_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('APPLICATION', 'REGISTRATION', 'HOSTEL')),
  entity_id UUID NOT NULL,
  fee_type_id UUID REFERENCES fee_types(id),
  amount NUMERIC NOT NULL,
  amount_paid NUMERIC DEFAULT 0,
  balance NUMERIC GENERATED ALWAYS AS (amount - amount_paid) STORED,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'cleared')),
  description TEXT,
  requested_by UUID REFERENCES auth.users(id),
  cleared_by UUID REFERENCES auth.users(id),
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2. Update `trainee_applications` Table

Add columns:
- `hostel_application_status` TEXT DEFAULT 'not_applied' (not_applied, applied, provisionally_allocated, allocated)
- Remove any auto-provisioning triggers on qualification

### 3. New `registrations` Table

```sql
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  trainee_id UUID NOT NULL REFERENCES trainees(id),
  application_id UUID REFERENCES trainee_applications(id),
  qualification_id UUID REFERENCES qualifications(id),
  academic_year TEXT NOT NULL,
  hostel_required BOOLEAN DEFAULT false,
  registration_status TEXT DEFAULT 'pending' CHECK (registration_status IN ('pending', 'fee_pending', 'registered')),
  registered_at TIMESTAMPTZ,
  registered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. Update Existing Constraints

Modify `registration_status` constraint to include all valid states:
- `applied` (initial submission)
- `provisionally_admitted` (qualified, awaiting payment)
- `pending_payment` (payment requested)
- `payment_cleared` (payment confirmed - TRIGGER POINT)
- `registered` (fully registered)

---

## Edge Functions Architecture

### 1. `submit-application` (New)

**Purpose**: Capture application without side effects

**Input**:
```json
{
  "application_data": { /* full application form */ }
}
```

**Logic**:
1. Validate required fields
2. Generate `application_number`
3. Save to `trainee_applications` with:
   - `qualification_status = 'pending'`
   - `registration_status = 'applied'`
   - `account_provisioning_status = 'not_started'`
4. If `needs_hostel_accommodation = true`, set `hostel_application_status = 'applied'`
5. DO NOT create trainee record
6. DO NOT create auth user
7. Return success with `application_id`

### 2. `screen-application` (New)

**Purpose**: Registration Officer screens application

**Input**:
```json
{
  "application_id": "uuid",
  "qualification_status": "provisionally_qualified" | "does_not_qualify",
  "remarks": "optional"
}
```

**Logic**:
1. Update `qualification_status`
2. If qualified:
   - Set `registration_status = 'provisionally_admitted'`
   - Create `financial_queue` entry for APPLICATION fees
3. Log audit trail
4. DO NOT provision account yet

### 3. `clear-application-fee` (Refactor)

**Purpose**: Debtor Officer clears application fee - TRIGGERS IDENTITY CREATION

**Input**:
```json
{
  "queue_id": "uuid",
  "amount": 1500,
  "payment_method": "training_grant"
}
```

**Logic (ATOMIC TRANSACTION)**:
1. Update `financial_queue` record
2. If fully cleared:
   a. Generate `trainee_number` using `generate_continuous_trainee_number(org_id)`
   b. Generate `system_email` using `generate_trainee_system_email(trainee_number, org_id)`
   c. Create `trainees` record from application data
   d. Create Supabase Auth user with default password
   e. Assign `trainee` role in `user_roles`
   f. Link `user_id` to both `trainees` and `trainee_applications`
   g. Update application `registration_status = 'payment_cleared'`
   h. Set `account_provisioning_status = 'auto_provisioned'`
3. Log to `provisioning_logs`
4. If ANY step fails: ROLLBACK entire transaction

### 4. `register-trainee` (Refactor)

**Purpose**: Registration Officer completes registration

**Input**:
```json
{
  "application_id": "uuid",
  "qualification_id": "uuid"
}
```

**Logic**:
1. Verify `registration_status = 'payment_cleared'`
2. Create `registrations` record
3. Create `financial_queue` entry for REGISTRATION fees
4. Update `registration_status = 'registered'`
5. If hostel required: Update `hostel_application_status = 'provisionally_allocated'`

### 5. `clear-registration-fee` (Refactor)

**Purpose**: Complete registration after fee payment

**Input**:
```json
{
  "queue_id": "uuid",
  "amount": 3000,
  "payment_method": "bank_transfer"
}
```

**Logic (ATOMIC TRANSACTION)**:
1. Clear `financial_queue` record
2. Update `registrations.registration_status = 'registered'`
3. If hostel required: Update `hostel_application_status = 'allocated'`
4. Create `trainee_financial_accounts` entry
5. Send notification to trainee

---

## Dashboard Visibility Rules

### Registration Officer Dashboard

| Status | Visible | Actions Available |
|--------|---------|-------------------|
| `applied` | Yes | Screen |
| `provisionally_admitted` | Yes | View (awaiting payment) |
| `payment_cleared` | Yes | Complete Registration |
| `registered` | Yes | View, Print PoR |

### Debtor Officer Dashboard ("Trainee Accounts")

| Queue Status | Entity Type | Visible | Actions |
|--------------|-------------|---------|---------|
| `pending` | APPLICATION | Yes | Clear Payment |
| `pending` | REGISTRATION | Yes | Clear Payment |
| `cleared` | Any | Archive view | View only |

### Hostel Coordinator Dashboard

| Conditions | Visible | Actions |
|------------|---------|---------|
| `hostel_applied = true` AND `registration_status = 'registered'` AND `hostel_allocated = false` | Yes | Allocate Room |

### Trainee Portal

| Data Source | Display |
|-------------|---------|
| `trainee_applications` | Admission status, qualification, registration progress |
| `financial_queue` | Payment requirements and history |
| `trainees` | Personal details once registered |
| `registrations` | Qualification enrolled, hostel status |

---

## Frontend Changes

### 1. Update Application Capture Flow

**File**: `src/hooks/useTraineeApplications.tsx`

- Remove auto-provisioning call from `useScreenApplication`
- Call `submit-application` Edge Function instead of direct insert
- Remove `setTimeout` hack for trigger waiting

### 2. Update Applications Table

**File**: `src/components/registration/ApplicationsTable.tsx`

- Remove "Create Account" button (provisioning happens at payment clearance)
- Update action buttons to reflect new workflow:
  - `applied`: Screen button
  - `provisionally_admitted`: "Awaiting Payment" indicator
  - `payment_cleared`: Register button
  - `registered`: View/Print

### 3. Debtor Officer Dashboard Refactor

**File**: `src/pages/DebtorOfficerDashboard.tsx`

- Update navigation label to "Trainee Accounts"
- Query from `financial_queue` table
- Display grouped by `entity_type` (Application Fees, Registration Fees)

### 4. Trainee Portal - Real Data Integration

**Files**:
- `src/pages/TraineeAdmissionStatusPage.tsx` - Query real application data
- `src/pages/TraineeDashboard.tsx` - Replace mock data with live queries
- `src/pages/trainee/TraineeFinancePage.tsx` - Already implemented, verify works

### 5. Hostel Coordinator Dashboard

**File**: `src/pages/HostelCoordinatorDashboard.tsx`

- Filter trainees by: `needs_hostel_accommodation = true` AND `registration_status = 'registered'`
- Only show unallocated trainees for allocation actions

---

## Logging & Recovery

### Provisioning Logs Structure (Existing)

```sql
-- Already exists: provisioning_logs table
-- Columns: id, organization_id, trainee_id, application_id, user_id, 
--          email, trigger_type, result, error_message, metadata, created_at
```

### Admin Reconciliation Tool (New Component)

Create `src/components/admin/ProvisioningReconciliation.tsx`:
- List applications where `registration_status IN ('payment_cleared', 'registered')` but `user_id IS NULL`
- "Retry Provisioning" bulk action
- Audit log viewer

---

## Implementation Phases

### Phase 1: Database Foundation (Migration)
1. Create `financial_queue` table
2. Create `registrations` table
3. Update `trainee_applications` with `hostel_application_status`
4. Add RLS policies for new tables
5. Remove any auto-provisioning triggers

### Phase 2: Edge Functions
1. Create `submit-application` function
2. Create `screen-application` function
3. Refactor `clear-application-fee` with atomic provisioning
4. Refactor `register-trainee` function
5. Create `clear-registration-fee` function

### Phase 3: Frontend Hooks
1. Update `useTraineeApplications.tsx` - remove auto-provisioning
2. Create `useFinancialQueue.tsx` hook
3. Update `usePaymentClearances.tsx` to use financial queue

### Phase 4: Dashboard Updates
1. Refactor `ApplicationsTable.tsx` action buttons
2. Update `DebtorOfficerDashboard.tsx` to use financial queue
3. Update `RegistrationOfficerDashboard.tsx` stats
4. Update `HostelCoordinatorDashboard.tsx` filtering

### Phase 5: Trainee Portal
1. Connect `TraineeAdmissionStatusPage.tsx` to real data
2. Update `TraineeDashboard.tsx` with live queries
3. Verify `TraineeFinancePage.tsx` integration

### Phase 6: Testing & Recovery Tools
1. Create reconciliation component
2. Test complete workflow end-to-end
3. Verify no orphaned auth accounts

---

## Technical Details

### Database Function: Atomic Provisioning

```sql
CREATE OR REPLACE FUNCTION provision_trainee_on_payment_cleared()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to 'cleared' for APPLICATION type
  IF NEW.status = 'cleared' AND OLD.status != 'cleared' 
     AND NEW.entity_type = 'APPLICATION' THEN
    
    -- The Edge Function handles the actual provisioning
    -- This trigger just ensures the status transition is valid
    
    PERFORM pg_notify('trainee_provisioning', json_build_object(
      'queue_id', NEW.id,
      'entity_id', NEW.entity_id,
      'organization_id', NEW.organization_id
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### RLS Policies for Financial Queue

```sql
-- Debtor officers can view and update their organization's queue
CREATE POLICY "Debtor officers manage financial queue"
ON financial_queue
FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('debtor_officer', 'admin', 'organization_admin', 'super_admin')
  )
);

-- Trainees can view their own queue entries
CREATE POLICY "Trainees view own queue"
ON financial_queue
FOR SELECT
TO authenticated
USING (
  entity_id IN (
    SELECT id FROM trainee_applications WHERE user_id = auth.uid()
    UNION
    SELECT id FROM trainees WHERE user_id = auth.uid()
  )
);
```

---

## Success Criteria

1. No Edge Function non-2xx errors in logs
2. No orphaned auth users (users without corresponding trainee records)
3. All dashboards populate correctly from explicit status fields
4. Financial workflows are fully auditable via `provisioning_logs` and `financial_queue`
5. Trainee portal shows real-time status from database
6. System handles concurrent requests without race conditions
7. Failed provisioning can be retried from admin dashboard

---

## Files to Create/Modify

### New Files
- `supabase/functions/submit-application/index.ts`
- `supabase/functions/screen-application/index.ts`
- `supabase/functions/clear-application-fee/index.ts`
- `supabase/functions/register-trainee/index.ts`
- `supabase/functions/clear-registration-fee/index.ts`
- `src/hooks/useFinancialQueue.tsx`
- `src/components/admin/ProvisioningReconciliation.tsx`
- `supabase/migrations/[timestamp]_workflow_refactor.sql`

### Modified Files
- `src/hooks/useTraineeApplications.tsx`
- `src/hooks/usePaymentClearances.tsx`
- `src/components/registration/ApplicationsTable.tsx`
- `src/pages/DebtorOfficerDashboard.tsx`
- `src/pages/RegistrationOfficerDashboard.tsx`
- `src/pages/HostelCoordinatorDashboard.tsx`
- `src/pages/TraineeDashboard.tsx`
- `src/pages/trainee/TraineeAdmissionStatusPage.tsx`
- `src/lib/navigationConfig.ts` (update Debtor label)
- `supabase/functions/provision-trainee-auth/index.ts` (refactor)
