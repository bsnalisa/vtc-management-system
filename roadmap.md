# Small-screen trainee and class details
- [x] Replace narrow trainee and class tables with labelled cards while preserving actions, filters and pagination.
- [x] Verify shared card rendering and content-width switching; authenticated trainee/class click-through is blocked because the preview is signed out and session minting found no matching account.

# Role menus and persistent sidebar
- [x] Add dedicated Liaison Officer and Resource Centre Coordinator menus, dashboards, partner directory, resource catalogue and loans; resolve missing menu destinations with explicit setup-required pages where no persistent records module exists.
- [x] Keep navigation visible at all sizes with a scrollable icon strip when collapsed, consistent role labels and accessible controls.
- [x] Verify all new destinations using the available Super Admin session and sidebar keyboard behaviour at 320, 375, 763 and 1280px without changing permissions; role-specific centre records need corresponding sessions.
- [ ] Implement persistent HR, project, BDL delivery and RPL portfolio/scheduling/credit modules separately; current setup-required pages do not create or manage those records.

# Dashboard navigation and logo cleanup
- [x] Share state-aware honeycomb/undo sidebar controls across dashboard shells and keep the header toggle accessible.
- [x] Remove duplicate sidebar and centre-header logos; verified a single system logo and working collapse/expand on Roles Management.

# Roles Management overlap follow-up
- [x] Reproduce and fix crowded headings, action buttons and role/permission tables; verified heading/action separation and no page overflow at 320, 375, 824 and 1280px, plus working Create Role and Permissions controls.
- [x] Applied approved centre-scoped assessment and trainer-trade read access; verified persisted predicates and anonymous SELECT denial. Other-role end-to-end checks require matching sessions and records.

# Mobile-first layout review
- [x] Audit shared layouts, tables, tabs, dialogs and crowded pages for overlap.
- [x] Apply presentation-only smaller-screen fixes and verify signed-in/public screens.
- [x] Apply approved centre-scoped attendance, schedule-history and permission access; verify persisted policies, anonymous denial and retained platform administrator access. Centre-staff and trainee end-to-end checks need corresponding sessions and records.

# Branding and loading consistency
- [x] Unify application branding across public pages and shared signed-in layouts.
- [x] Standardize loading indicators and verify public screens.

# Homepage carousel
- [x] Add Networking, Welding and Web Development images and compact wrapping pagination for up to ten courses; verified course selection, image loading and controls at 320, 375, 587 and 1280px. Existing 320px header overflow is outside the carousel.
- [ ] Await approval to dismiss the workflow process-type security false positive: the table contains only shared category names/descriptions, not private records; existing signed-in read access is intentional.
- [x] Add vocational-training imagery and an interactive homepage carousel.
- [x] Rearrange homepage sections and verify carousel controls and application navigation.

# System UI refresh
- [x] Apply Quiet workspace colour, font and shared control styling.
- [x] Restyle shared navigation and role dashboards without workflow changes.
- [x] Align public homepage with the selected visual language.
- [x] Verify public pages, application navigation, mobile layout and current build status.
- [x] Verify signed-in Super Admin screens using the available preview session; other role-only workflows remain outside this account's access.
- [x] Home page AI chatbot "Skilla": application help + Namibian VTC landscape, courses, NTA knowledge
- [x] Skilla uses real per-centre courses, fees, contacts from the system
- [x] Move Skilla to the Online Application tab
- [x] Publish and test Skilla with real NTA/centre questions
- [x] Skilla available on every page, answers limited to signed-in role
