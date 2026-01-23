# Testing Plan & QA Workflow

## Testing Strategy Overview

This document outlines the comprehensive testing approach for the Nakayale VTC Management System, ensuring quality, security, and reliability across all modules.

---

## Testing Levels

### 1. Unit Testing
- **Scope**: Individual functions and components
- **Responsibility**: Lead Developer
- **Frequency**: During development
- **Tools**: Jest, React Testing Library
- **Coverage Target**: 80%+ on utility functions

### 2. Integration Testing
- **Scope**: Module interactions, API endpoints
- **Responsibility**: Lead Developer + QA Tester
- **Frequency**: Before each feature completion
- **Tools**: Supertest, Postman
- **Coverage Target**: 90%+ on critical paths

### 3. System Testing
- **Scope**: End-to-end workflows
- **Responsibility**: QA Tester
- **Frequency**: Weekly on staging
- **Tools**: Manual testing, Playwright (future)
- **Coverage Target**: 100% of user workflows

### 4. Security Testing
- **Scope**: RLS policies, authentication, data isolation
- **Responsibility**: Super Admin Tester
- **Frequency**: Before each release + monthly audits
- **Tools**: Supabase Linter, Manual verification
- **Coverage Target**: Zero critical vulnerabilities

### 5. User Acceptance Testing (UAT)
- **Scope**: Real-world scenarios
- **Responsibility**: Pilot Partner VTC
- **Frequency**: Before major releases
- **Tools**: Production-like staging environment
- **Coverage Target**: Sign-off from key stakeholders

---

## Module-Specific Test Plans

### Authentication & Authorization

#### Test Cases
1. **User Registration**
   - [ ] Valid email signup creates account
   - [ ] Duplicate email shows error
   - [ ] Password requirements enforced
   - [ ] Email confirmation works (if enabled)
   - [ ] Auto-login after registration

2. **User Login**
   - [ ] Valid credentials allow access
   - [ ] Invalid credentials show error
   - [ ] Password reset flow works
   - [ ] Session persists across page refresh
   - [ ] Logout clears session

3. **Role-Based Access**
   - [ ] Admin can access all features
   - [ ] Trainers can access trainer features only
   - [ ] Trainees can access trainee features only
   - [ ] Debtor Officer can access fee management
   - [ ] HOD can access all reports
   - [ ] Registration Officer can manage trainees

#### Security Tests
- [ ] JWT tokens expire correctly
- [ ] Session hijacking prevented
- [ ] SQL injection attempts blocked
- [ ] XSS attacks mitigated
- [ ] CSRF protection enabled

---

### Trainee Management

#### Test Cases
1. **Trainee Registration**
   - [ ] All required fields validated
   - [ ] Trainee ID auto-generated correctly
   - [ ] Duplicate national ID prevented
   - [ ] Photo upload works (if enabled)
   - [ ] Organization association correct

2. **Trainee CRUD Operations**
   - [ ] List view shows all trainees for organization
   - [ ] Search filters work correctly
   - [ ] Edit updates trainee information
   - [ ] Delete removes trainee (soft delete)
   - [ ] Status changes (active, suspended, graduated)

3. **Multi-Tenant Isolation**
   - [ ] Organization A cannot see Organization B's trainees
   - [ ] Search respects organization boundaries
   - [ ] Export only includes own trainees

#### Performance Tests
- [ ] List loads in <2 seconds with 1,000 trainees
- [ ] Search returns results in <1 second
- [ ] Pagination works smoothly

---

### Fee Management

#### Test Cases
1. **Fee Record Creation**
   - [ ] Total fee calculated correctly
   - [ ] Balance calculated (total - paid)
   - [ ] Academic year assigned correctly
   - [ ] Organization linked correctly

2. **Payment Recording**
   - [ ] Payment reduces balance
   - [ ] Multiple payments accumulate correctly
   - [ ] Payment methods recorded
   - [ ] Reference numbers unique
   - [ ] Audit trail created

3. **Fee Calculations**
   - [ ] Collection rate computed accurately
   - [ ] Outstanding balances correct
   - [ ] Fee statistics aggregated properly

#### Data Integrity Tests
- [ ] No negative balances
- [ ] Amount paid ≤ total fee
- [ ] Decimal precision maintained (2 places)

---

### Attendance Management

#### Test Cases
1. **Attendance Register Creation**
   - [ ] Date range validated
   - [ ] Trainer assigned correctly
   - [ ] Trade and level specified
   - [ ] Academic year set

2. **Attendance Marking**
   - [ ] Present/absent toggled correctly
   - [ ] Bulk marking works
   - [ ] Remarks saved
   - [ ] Cannot mark future dates

3. **Attendance Reports**
   - [ ] Attendance percentage calculated
   - [ ] Export includes all records
   - [ ] Filters work correctly

---

### Assessment & Grading

#### Test Cases
1. **Assessment Creation**
   - [ ] Assessment type linked correctly
   - [ ] Max marks validated
   - [ ] Term and academic year set
   - [ ] Due date in future

2. **Marks Entry**
   - [ ] Marks ≤ max marks
   - [ ] Marks can be updated before lock
   - [ ] Locked marks cannot be edited
   - [ ] Assessment Coordinator can edit locked marks

3. **Results Calculation**
   - [ ] Total marks calculated correctly
   - [ ] Weighted average computed
   - [ ] Competency status determined
   - [ ] Trainees can view own results only

---

### Reporting

#### Test Cases
1. **Report Generation**
   - [ ] All report types accessible
   - [ ] Export to CSV works
   - [ ] Export to Excel works
   - [ ] Reports include correct data

2. **Data Accuracy**
   - [ ] Trainee counts correct
   - [ ] Fee totals accurate
   - [ ] Attendance percentages right
   - [ ] Date ranges respected

---

### Communication (Messages & Announcements)

#### Test Cases
1. **Internal Messaging**
   - [ ] Send message to user
   - [ ] Receive message notification
   - [ ] Reply to message
   - [ ] Mark as read
   - [ ] Inbox/Sent views work

2. **Announcements**
   - [ ] Create announcement (Admin/HOD)
   - [ ] Target specific roles
   - [ ] Set expiration date
   - [ ] View active announcements
   - [ ] Announcements auto-expire

3. **Notifications**
   - [ ] Notifications created on events
   - [ ] Unread count correct
   - [ ] Mark all as read works
   - [ ] Notification types styled correctly

---

### Multi-Tenancy & Packages

#### Test Cases
1. **Organization Management**
   - [ ] Create organization (Super Admin)
   - [ ] Assign package
   - [ ] Set trial period
   - [ ] Organization isolation verified
   - [ ] Subdomain routing works

2. **Package Enforcement**
   - [ ] Module access controlled by package
   - [ ] Limits enforced (trainees, trainers)
   - [ ] Trial expiry disables access
   - [ ] Upgrade/downgrade works

3. **Data Isolation (CRITICAL)**
   - [ ] Organization A cannot query Organization B's data
   - [ ] RLS policies on all tables
   - [ ] API endpoints respect organization
   - [ ] Search scoped to organization

---

### Global Search

#### Test Cases
1. **Search Functionality**
   - [ ] Search finds trainees by name
   - [ ] Search finds trainees by ID
   - [ ] Search finds trainers
   - [ ] Search finds courses
   - [ ] Relevance ranking works

2. **Performance**
   - [ ] Results return in <1 second
   - [ ] Handles typos gracefully
   - [ ] Debouncing works (no lag on typing)

---

### API Gateway

#### Test Cases
1. **Authentication**
   - [ ] Requires Bearer token
   - [ ] Rejects invalid tokens
   - [ ] Rejects expired tokens

2. **Organization Analytics**
   - [ ] Returns correct metrics
   - [ ] Requires org_id parameter
   - [ ] Data scoped to organization

3. **System Analytics**
   - [ ] Super Admin only access
   - [ ] Returns all organizations data
   - [ ] Package usage calculated

4. **Integration Endpoint**
   - [ ] Accepts sync data
   - [ ] Logs sync attempts
   - [ ] Returns success/error

---

### Automated Jobs (CRON)

#### Test Cases
1. **Subscription Monitor**
   - [ ] Runs on schedule
   - [ ] Identifies expiring subscriptions
   - [ ] Creates notifications
   - [ ] Logs audit events
   - [ ] Expires overdue subscriptions

2. **Scheduled Reports**
   - [ ] Weekly reports generated
   - [ ] Monthly reports generated
   - [ ] Notifications sent to correct users
   - [ ] Data accurate in reports

---

## Testing Workflow

### Feature Development Cycle

```
1. Development
   ├─ Lead Developer codes feature
   ├─ Write unit tests
   └─ Local testing

2. Code Review
   ├─ Pull request created
   ├─ Code review by team
   └─ Merge to staging branch

3. Integration Testing
   ├─ Deploy to staging
   ├─ QA Tester executes test cases
   └─ Log bugs in GitHub Issues

4. Bug Fixes
   ├─ Lead Developer fixes bugs
   ├─ Re-deploy to staging
   └─ Regression testing

5. Security Testing
   ├─ Super Admin Tester verifies RLS
   ├─ Security scan runs
   └─ Vulnerabilities addressed

6. UAT (if major feature)
   ├─ Pilot Partner tests feature
   ├─ Feedback collected
   └─ Refinements made

7. Production Deployment
   ├─ Deploy to production
   ├─ Smoke tests in production
   └─ Monitor for 48 hours
```

---

## Bug Tracking

### Severity Levels

**Critical (P0)**
- System down or data loss
- Security vulnerability
- Data corruption
- **Response Time**: Immediate
- **Fix Time**: <4 hours

**High (P1)**
- Major feature broken
- Workflow blocked
- Performance severely degraded
- **Response Time**: <2 hours
- **Fix Time**: <24 hours

**Medium (P2)**
- Feature partially working
- Workaround available
- UI inconsistency
- **Response Time**: <24 hours
- **Fix Time**: <1 week

**Low (P3)**
- Minor cosmetic issue
- Edge case bug
- Enhancement request
- **Response Time**: <1 week
- **Fix Time**: Next release

### Bug Report Template

```markdown
## Bug Description
[Clear description of the issue]

## Steps to Reproduce
1. Go to [page]
2. Click on [button]
3. Enter [data]
4. Observe [error]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Browser: [Chrome/Safari/Firefox/Edge]
- Device: [Desktop/Mobile/Tablet]
- OS: [Windows/Mac/iOS/Android]
- Organization: [If multi-tenant issue]

## Screenshots
[Attach screenshots if applicable]

## Severity
[Critical/High/Medium/Low]

## Assigned To
[Team member responsible]
```

---

## Test Environments

### Local Development
- **Purpose**: Feature development and initial testing
- **Database**: Local Supabase instance
- **Data**: Seed data
- **URL**: `http://localhost:5173`

### Staging
- **Purpose**: Integration testing and QA
- **Database**: Staging Supabase project
- **Data**: Anonymized production-like data
- **URL**: `https://staging.vtc.example.com`

### Production
- **Purpose**: Live system
- **Database**: Production Supabase project
- **Data**: Real data
- **URL**: `https://vtc.lovable.app` (or custom domain)

---

## Testing Checklist (Pre-Release)

### Functionality
- [ ] All test cases passed for modified modules
- [ ] Regression tests passed
- [ ] New features documented
- [ ] Error handling works correctly

### Performance
- [ ] Page load times <2 seconds
- [ ] Search results <1 second
- [ ] Large datasets handled gracefully
- [ ] No memory leaks detected

### Security
- [ ] RLS policies verified
- [ ] No SQL injection vulnerabilities
- [ ] Authentication working correctly
- [ ] Data isolation confirmed
- [ ] Supabase linter shows no critical issues

### UI/UX
- [ ] Design consistent across pages
- [ ] Responsive on mobile devices
- [ ] Accessible (WCAG 2.1 compliance)
- [ ] Dark mode working (if applicable)
- [ ] Forms validated properly

### Data Integrity
- [ ] Database migrations successful
- [ ] Data relationships intact
- [ ] No orphaned records
- [ ] Backups working

### Documentation
- [ ] Changelog updated
- [ ] User documentation updated (if needed)
- [ ] API documentation updated (if applicable)
- [ ] Deployment notes prepared

---

## Automated Testing (Future)

### Planned Automation
- **E2E Tests**: Playwright for critical workflows
- **API Tests**: Automated Postman collections
- **Performance Tests**: Lighthouse CI in GitHub Actions
- **Security Scans**: Automated OWASP ZAP scans

### GitHub Actions Workflows
```yaml
# .github/workflows/test.yml
name: Automated Tests
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run unit tests
        run: npm test
      - name: Run Lighthouse CI
        run: npm run lighthouse:ci
      - name: Security scan
        run: npm run security:scan
```

---

## Monitoring & Logging

### Production Monitoring
- **Uptime**: Pingdom or UptimeRobot
- **Errors**: Sentry or LogRocket
- **Performance**: Supabase Dashboard
- **Usage**: Google Analytics (anonymized)

### Log Levels
- **ERROR**: Critical issues requiring immediate attention
- **WARN**: Potential problems or degraded performance
- **INFO**: Normal operations and milestones
- **DEBUG**: Detailed information for troubleshooting

---

## Feedback Loop

### User Feedback Channels
1. **In-App Feedback**: Button in UI (future)
2. **GitHub Issues**: Bug reports and feature requests
3. **Pilot Partner Meetings**: Monthly feedback sessions
4. **Support Tickets**: Help desk system (future)

### Feedback Processing
1. QA Tester triages new issues
2. Lead Developer prioritizes and assigns
3. Team addresses within SLA
4. Reporter notified of resolution

---

## Continuous Improvement

### Quarterly QA Review
- Analyze bug trends
- Update test cases based on new learnings
- Refine testing processes
- Update this document

### Metrics Tracked
- **Bug Density**: Bugs per feature
- **Escape Rate**: Bugs found in production
- **Test Coverage**: % of code covered
- **Mean Time to Resolution**: Average bug fix time

---

**Last Updated**: November 2025  
**Next Review**: January 2026  
**Owner**: QA Tester + Super Admin Tester
