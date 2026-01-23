# Package & Billing Engine Documentation

## Overview

The Package & Billing Engine provides subscription-based feature access control for the VTC Management System. Each organization operates within their assigned package limits with automatic enforcement and upgrade capabilities.

## Database Schema

### Tables Created

#### 1. `packages` Table
Defines available subscription tiers with pricing and feature access:
- **Fields**: id, name, price, billing_cycle, module_access (JSONB), limits (JSONB), description, features, is_trial, trial_days, active
- **Example modules**: trainee_management, trainer_management, class_management, attendance_tracking
- **Limits**: max_trainees, max_trainers, max_classes, max_storage_mb (null = unlimited)

#### 2. `organization_packages` Table
Tracks current and historical package assignments:
- **Fields**: id, organization_id, package_id, start_date, end_date, status, is_trial, auto_renew
- **Statuses**: active, expired, cancelled, suspended
- **Constraint**: Unique(organization_id, package_id, status) prevents duplicate active packages

#### 3. `billing_records` Table
Payment and invoice tracking:
- **Fields**: id, organization_id, organization_package_id, amount, currency, invoice_no, payment_method, payment_date, due_date, status, description, metadata
- **Statuses**: pending, paid, failed, refunded, cancelled

## Database Functions

### `get_organization_active_package(_org_id UUID)`
Returns the current active package for an organization including:
- Package details (name, module_access, limits)
- Trial status and end date
- Used in the organization context to determine feature access

### `organization_has_module(_org_id UUID, _module_code TEXT)`
Boolean check if organization has access to a specific module based on their active package.

### `check_organization_limit(_org_id UUID, _limit_type TEXT, _current_count INTEGER)`
Validates if current usage is within package limits:
- Returns `true` if within limits or if limit is unlimited (null)
- Used before creating new records (trainees, trainers, classes)

### `expire_trial_packages()`
Automatically expires trial packages past their end_date:
- Called daily via cron job
- Returns list of expired trials for notification
- Updates status to 'expired'

## Module Codes

Predefined module codes in `MODULE_CODES` constant:
```typescript
TRAINEE_MANAGEMENT = "trainee_management"
TRAINER_MANAGEMENT = "trainer_management"
CLASS_MANAGEMENT = "class_management"
ATTENDANCE_TRACKING = "attendance_tracking"
FEE_MANAGEMENT = "fee_management"
ASSESSMENT_MANAGEMENT = "assessment_management"
TIMETABLE_MANAGEMENT = "timetable_management"
DOCUMENT_GENERATION = "document_generation"
BASIC_REPORTING = "basic_reporting"
ADVANCED_REPORTING = "advanced_reporting"
API_ACCESS = "api_access"
```

## Default Packages

Four packages are created by default:

### 1. Basic (Free)
- **Price**: $0/month
- **Limits**: 50 trainees, 5 trainers, 10 classes, 100MB storage
- **Modules**: trainee_management, trainer_management, basic_reporting

### 2. Extended ($49.99/month)
- **Limits**: 200 trainees, 20 trainers, 50 classes, 500MB storage
- **Modules**: All Basic + class_management, attendance_tracking, fee_management, advanced_reporting

### 3. Professional ($99.99/month)
- **Limits**: Unlimited trainees, trainers, classes; 5GB storage
- **Modules**: All Extended + assessment_management, timetable_management, document_generation, api_access

### 4. 14-Day Trial (Free)
- **Duration**: 14 days
- **Limits**: 20 trainees, 3 trainers, 5 classes, 50MB storage
- **Modules**: Core features for evaluation

## React Hooks

### `usePackages()`
Fetches all active packages for display:
```typescript
const { data: packages, isLoading } = usePackages();
```

### `useOrganizationPackage(organizationId)`
Gets current active package for an organization:
```typescript
const { data: currentPackage } = useOrganizationPackage(organizationId);
```

### `useAssignPackage()`
Assigns a package to an organization (cancels existing):
```typescript
const assignPackage = useAssignPackage();
await assignPackage.mutateAsync({
  organizationId,
  packageId,
  isTrial: true,
  trialDays: 14,
});
```

### `useUpgradePackage()`
Upgrades organization to a new package:
```typescript
const upgradePackage = useUpgradePackage();
await upgradePackage.mutateAsync({
  organizationId,
  newPackageId,
});
```

### `useBillingRecords(organizationId)`
Fetches billing history for an organization:
```typescript
const { data: billingRecords } = useBillingRecords(organizationId);
```

## Utility Functions

### Package Access Checks
```typescript
import { hasModuleAccess, isWithinLimit } from "@/lib/packageUtils";

// Check module access
const canAccessFees = hasModuleAccess(
  packageInfo.module_access,
  MODULE_CODES.FEE_MANAGEMENT
);

// Check limits before creating records
const canAddTrainee = isWithinLimit(
  packageInfo.limits,
  "max_trainees",
  currentTraineeCount
);
```

### Other Utilities
- `getRemainingCapacity()` - Calculate slots remaining
- `getDaysRemaining()` - Days left in subscription/trial
- `isPackageExpired()` - Check if package is past end_date
- `formatPackagePrice()` - Display formatted pricing
- `getUpgradeRecommendation()` - Suggest upgrades based on limits

## Organization Context Integration

The `useOrganizationContext` hook now includes package information:
```typescript
const {
  organizationId,
  packageInfo, // Current package details
  hasModuleAccess, // Function to check module access
} = useOrganizationContext();

// Use in components
if (hasModuleAccess(MODULE_CODES.FEE_MANAGEMENT)) {
  // Show fee management features
}
```

## Trial Expiration System

### Edge Function: `expire-trials-and-notify`
Runs daily to:
1. Call `expire_trial_packages()` to mark expired trials
2. Fetch organization admins for each expired trial
3. Create notifications in `notifications` table
4. Return summary of expired trials and notifications sent

### Setup Cron Job
```sql
SELECT cron.schedule(
  'expire-trials-daily',
  '0 2 * * *', -- Every day at 2:00 AM
  $$
  SELECT net.http_post(
    url := 'https://osiokcprjgwypmamvjhm.supabase.co/functions/v1/expire-trials-and-notify',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

## Dashboard Integration Examples

### Conditional Feature Display
```typescript
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { MODULE_CODES } from "@/lib/packageUtils";

const Dashboard = () => {
  const { hasModuleAccess, packageInfo } = useOrganizationContext();

  return (
    <Layout>
      {hasModuleAccess(MODULE_CODES.TRAINEE_MANAGEMENT) && (
        <Link to="/trainees">Manage Trainees</Link>
      )}
      
      {hasModuleAccess(MODULE_CODES.FEE_MANAGEMENT) && (
        <Link to="/fees">Fee Management</Link>
      )}
      
      {!hasModuleAccess(MODULE_CODES.ASSESSMENT_MANAGEMENT) && (
        <Alert>
          <p>Assessment features are available in Extended and Professional packages.</p>
          <Button onClick={() => navigate('/packages')}>Upgrade Now</Button>
        </Alert>
      )}
    </Layout>
  );
};
```

### Limit Enforcement Before Creation
```typescript
import { isWithinLimit } from "@/lib/packageUtils";

const TraineeRegistration = () => {
  const { packageInfo, organizationId } = useOrganizationContext();
  const { data: trainees } = useTrainees(organizationId);

  const handleSubmit = async (data) => {
    // Check limit before allowing registration
    if (!isWithinLimit(packageInfo?.limits, "max_trainees", trainees?.length || 0)) {
      toast({
        title: "Limit Reached",
        description: "You've reached the maximum trainees for your package. Please upgrade.",
        variant: "destructive",
      });
      return;
    }
    
    // Proceed with registration
    await registerTrainee(data);
  };
};
```

### Trial Expiration Warning
```typescript
import { getDaysRemaining } from "@/lib/packageUtils";

const Header = () => {
  const { packageInfo } = useOrganizationContext();
  const daysRemaining = packageInfo?.end_date 
    ? getDaysRemaining(packageInfo.end_date) 
    : null;
  
  const showWarning = packageInfo?.is_trial && daysRemaining !== null && daysRemaining <= 3;

  return (
    <header>
      {showWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your trial expires in {daysRemaining} days. 
            <Link to="/packages">Upgrade now</Link> to keep access.
          </AlertDescription>
        </Alert>
      )}
    </header>
  );
};
```

## Security Considerations

### Row Level Security (RLS)
- **packages**: Everyone can view active packages
- **organization_packages**: Organizations can only view their own packages
- **billing_records**: Organizations can view their own billing, admins can manage

### Access Control
- Package assignment requires super_admin role
- Upgrades can be done by organization_admin or admin
- Module access is enforced at the UI and context level
- Database functions use SECURITY DEFINER for safe RLS policy checks

## Upgrade/Downgrade Logic

### Upgrade Process
1. User selects new package on `/packages` page
2. `useUpgradePackage()` is called
3. Current active package is set to 'cancelled' status
4. New package record is created with 'active' status
5. Organization context refreshes with new package info
6. UI re-renders based on new module access

### Downgrade Considerations
- Same flow as upgrade (cancel old, activate new)
- Data remains but may become inaccessible if module is removed
- No automatic data deletion
- Consider warning users about feature loss before downgrade

## Billing Integration (Future Enhancement)

The `billing_records` table is ready for integration with payment processors:
- Store invoice numbers and payment methods
- Track payment status (pending, paid, failed)
- Link records to `organization_packages` via foreign key
- Metadata JSONB field for processor-specific data

## Testing Checklist

- [ ] Create test organizations with different packages
- [ ] Verify module access restrictions work correctly
- [ ] Test limit enforcement (trainees, trainers, classes)
- [ ] Confirm trial expiration notifications are sent
- [ ] Validate upgrade/downgrade flows
- [ ] Check that cancelled packages don't grant access
- [ ] Verify RLS policies prevent cross-organization access
- [ ] Test package assignment by super_admin
- [ ] Confirm UI updates after package changes
- [ ] Validate billing records creation and display

## Future Enhancements

1. **Payment Integration**: Connect to Stripe/PayPal for automated billing
2. **Usage Analytics**: Track feature usage per organization
3. **Custom Packages**: Allow super_admins to create custom package configurations
4. **Grace Periods**: Add configurable grace period after expiration
5. **Prorated Upgrades**: Calculate prorated charges for mid-cycle upgrades
6. **Package Recommendations**: AI-driven package suggestions based on usage
7. **Multi-Currency Support**: Extend beyond USD
8. **Annual Discounts**: Add discount logic for yearly subscriptions
