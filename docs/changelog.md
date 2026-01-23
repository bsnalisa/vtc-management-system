# Changelog

All notable changes to the Nakayale VTC Management System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0-enterprise] - 2025-11-03

### 🚀 Added
- **Global Search**: Full-text search across trainees, trainers, and courses
  - PostgreSQL GIN indexes for fast text search
  - Relevance-based ranking
  - Organization-scoped results
  - Search button in header with real-time results
- **API Gateway**: RESTful API for external integrations
  - Organization analytics endpoint
  - System-wide analytics (Super Admin)
  - Global search API
  - MTC/NTA integration endpoint (placeholder)
  - JWT authentication on all endpoints
- **Automated CRON Jobs**:
  - `subscription-monitor`: Daily subscription expiry checks
  - `scheduled-reports`: Weekly/monthly automated reports
  - Notification system for expiry warnings
- **Analytics Dashboard**: System-wide and organization-level metrics
  - Total organizations, users, packages (Super Admin)
  - Trainee, trainer, fee statistics (Organization)
  - Package usage distribution charts
  - Recent system activity logs
- **Performance Optimization**:
  - 15+ database indexes on critical queries
  - Composite indexes for multi-column lookups
  - Full-text search indexes
  - Query optimization for large datasets
- **Export Functionality**: Universal export for all data tables
  - CSV export with proper formatting
  - Excel-compatible exports
  - Nested object flattening
  - Export utilities library
- **Integration Layer**: Foundation for external system sync
  - MTC/NTA sync endpoint
  - Audit logging for all sync attempts
  - Extensible architecture
- **Documentation**: Comprehensive enterprise setup guides
  - `ENTERPRISE_SETUP.md`: Enterprise features and deployment
  - `PWA_SETUP.md`: Progressive Web App installation guide
  - CRON job configuration examples
  - API usage documentation

### 🔧 Changed
- Enhanced Reports module with export buttons
- Improved Announcements to auto-create notifications
- Optimized database queries for better performance
- Updated Supabase functions for error handling

### 🐛 Fixed
- TypeScript errors in edge functions (error type handling)
- Layout import for GlobalSearch component
- Analytics dashboard array handling

### 📚 Documentation
- Added enterprise deployment guide
- Created PWA setup instructions
- Documented API gateway endpoints
- Added CRON job setup examples

---

## [1.5.0-communication] - 2025-06-15

### 🚀 Added
- **Internal Messaging System**:
  - Send messages between users
  - Inbox and Sent folders
  - Read/Unread status
  - Message notifications
  - User selection dropdown
- **Enhanced Announcements**:
  - Target specific roles
  - Expiration dates
  - Priority levels (normal, important, urgent)
  - Active/inactive status
- **Notifications System**:
  - In-app notifications
  - Unread count badge
  - Mark as read functionality
  - Mark all as read
  - Notification types (message, announcement, subscription, report)
- **Audit Logging**:
  - System-wide activity tracking
  - User action logging
  - Organization-level logs
  - Audit log viewing (Admin/Super Admin)

### 🔧 Changed
- Improved notification UX
- Enhanced dashboard with recent activity
- Updated navigation with Messages link

### 🐛 Fixed
- Notification read status synchronization
- Message notification duplicates

---

## [1.0.0-multi-tenant] - 2025-03-20

### 🚀 Added
- **Multi-Tenant Architecture**:
  - Organization management system
  - Organization-specific data isolation
  - RLS policies on all tables
- **Package System**:
  - Basic, Professional, Enterprise packages
  - Module-based access control
  - Usage limits (trainees, trainers, classes, storage)
  - Trial period support
  - Auto-renewal configuration
- **Super Admin Features**:
  - Organization management dashboard
  - Package assignment interface
  - User management across organizations
  - System-wide analytics
- **Organization Settings**:
  - Custom branding (logo, colors)
  - Subdomain routing
  - Package configuration
- **Subscription Management**:
  - Trial expiry automation
  - Subscription notifications
  - Package upgrade/downgrade

### 🔧 Changed
- All queries now organization-scoped
- Dashboard statistics organization-specific
- User management per organization
- Reports filtered by organization

### 🐛 Fixed
- Cross-organization data leakage
- RLS policy gaps
- Subdomain routing issues

### 📚 Documentation
- Added `SUBDOMAIN_ROUTING.md`
- Created `PACKAGE_BILLING_ENGINE.md`
- Updated deployment guide for multi-tenancy

---

## [0.5.0-enhanced] - 2024-12-10

### 🚀 Added
- **Fee Management**:
  - Fee record creation
  - Payment tracking
  - Balance calculations
  - Collection rate reporting
  - Payment history
- **Assessment System**:
  - Assessment types (tests, assignments, exams)
  - Marks entry and grading
  - Mark locking (Assessment Coordinator)
  - Trainee results viewing
  - Performance tracking
- **Advanced Reporting**:
  - 10+ report types
  - Export functionality
  - Attendance summaries
  - Fee collection reports
  - Trainee progress statistics
- **Document Generation**:
  - PDF generation edge function
  - Certificate templates
  - Invoice templates
  - Report templates
  - Letter templates

### 🔧 Changed
- Enhanced dashboard with financial metrics
- Improved data visualization
- Optimized report generation

### 🐛 Fixed
- Fee calculation precision issues
- Mark validation edge cases
- Report export formatting

---

## [0.2.0-core-features] - 2024-10-05

### 🚀 Added
- **Trainee Management**:
  - Trainee registration form
  - Trainee list with search/filter
  - Trainee profile editing
  - Status management (active, suspended, graduated)
  - Auto-generated trainee IDs
- **Trainer Management**:
  - Trainer registration
  - Trade assignment
  - Employment type tracking
  - Trainer-trade relationships
- **Class Management**:
  - Class creation and scheduling
  - Class capacity management
  - Trainer assignment to classes
  - Academic year tracking
- **Course Management**:
  - Course catalog
  - Unit standards linking
  - Trade-specific courses
  - Level-based courses
- **Attendance System**:
  - Attendance register creation
  - Daily attendance marking
  - Attendance reports
  - Bulk marking functionality
- **Enrollment System**:
  - Course enrollment workflow
  - Enrollment validation
  - Training mode restrictions
  - Academic year tracking

### 🔧 Changed
- Improved navigation structure
- Enhanced form validation
- Better error handling

### 🐛 Fixed
- Duplicate trainee ID generation
- Attendance date validation
- Enrollment constraint violations

---

## [0.1.0-foundation] - 2024-09-01

### 🚀 Added
- **Authentication System**:
  - Email/password signup
  - Email/password login
  - Password reset flow
  - Session management
  - Auto-confirm for non-production
- **Role-Based Access Control**:
  - 6 user roles defined
  - Admin role
  - Trainer role
  - Trainee role
  - Assessment Coordinator role
  - Debtor Officer role
  - HOD role
  - Registration Officer role
- **Dashboard System**:
  - Role-specific dashboards
  - Basic statistics cards
  - Navigation sidebar
  - Quick actions
- **User Management**:
  - User profile creation
  - Profile editing
  - Role assignment
  - User list viewing
- **Database Schema**:
  - Core tables created
  - RLS policies implemented
  - Database functions
  - Triggers for automation
- **UI Foundation**:
  - Shadcn UI components
  - Tailwind CSS design system
  - Responsive layouts
  - Dark mode ready

### 🔧 Changed
- Initial project setup

### 📚 Documentation
- Created `README.md`
- Added `SETUP_COMPLETE.md`
- Initial deployment guide

---

## Version Naming Convention

- **Major version (X.0.0)**: Significant architectural changes, breaking changes
- **Minor version (0.X.0)**: New features, enhancements, non-breaking changes
- **Patch version (0.0.X)**: Bug fixes, minor updates

## Change Categories

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes
- **Documentation**: Documentation updates

---

## Unreleased Changes

### In Progress
- PWA implementation (icons, manifest, service worker)
- Push notification system
- Enhanced mobile UI
- Biometric attendance integration

### Planned for Next Release (2.1.0)
- Offline-first capabilities
- Push notifications
- MTC/NTA integration
- Advanced charts and visualizations
- Email notification integration (Resend)

---

## Contributing

When adding entries to this changelog:
1. Add to "Unreleased Changes" section first
2. Use present tense ("Add feature" not "Added feature")
3. Include issue/PR numbers if applicable
4. Group by category (Added, Changed, Fixed, etc.)
5. Move to versioned section when released

## Questions?

For questions about specific changes, see:
- GitHub Issues for detailed discussions
- Pull Requests for implementation details
- `docs/roadmap.md` for planned features

---

**Maintained By**: Lead Developer  
**Last Updated**: 2025-11-03
