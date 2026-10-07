# Architecture rules
- Keep the system visual theme in global semantic HSL tokens and shared UI primitives so every role inherits consistent presentation without changing authorization or workflows.
- DashboardLayout remains the common role-page shell with a fixed top header, collapsible sidebar and scrollable content; role colours identify roles without overriding the shared system palette.
- Load locally packaged fonts through the global stylesheet so system typography does not depend on remote font requests.