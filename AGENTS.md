# Architecture rules
- Keep the system visual theme in global semantic HSL tokens and shared UI primitives so every role inherits consistent presentation without changing authorization or workflows.
- DashboardLayout remains the common role-page shell with a fixed top header, collapsible sidebar and scrollable content; role colours identify roles without overriding the shared system palette.
- Load locally packaged fonts through the global stylesheet so system typography does not depend on remote font requests.
- Organization branding may customize content accent tokens, but sidebar tokens always inherit the shared workspace theme; removing branding restores stylesheet defaults.
- Keep the public training hero in a dedicated component using the shared Embla carousel and UI controls, with pause-on-interaction and reduced-motion support to preserve accessibility independently of application workflows.