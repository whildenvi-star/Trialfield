# Phase 25: Auth + Middleware + Route Protection - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can log in with email and password, unauthenticated requests are redirected to /login by middleware, admin routes reject non-admin users, module routes enforce per-user access grants, and a complete admin panel allows user/role/access management. Phase 26 handles the landing page, dashboard cards, and module shell pages.

</domain>

<decisions>
## Implementation Decisions

### Login page
- Centered card layout on the dark soil background (#080604)
- Functional forgot password link using Supabase's password reset email flow
- Login errors displayed as a single banner above the form — does NOT reveal which field failed (security best practice)
- Email + password fields with sign-in button — clean and minimal

### Denied access feedback
- Module access denied: Toast notification that auto-dismisses, showing specific module name — e.g., "You don't have access to Organic Cert. Contact your administrator for access."
- Admin route denied (/admin for non-admin users): Silent redirect to /dashboard — no toast, no hint that the admin panel exists

### Session management
- Expired sessions redirect to /login immediately (no modal overlay)
- Login page shows "Your session has expired. Please log in again." when redirected due to expiry
- Logout via user menu dropdown in the header (click user name/avatar to reveal dropdown with "Log out" option)

### Admin panel (full delivery in Phase 25)
- Complete admin panel built in this phase — API endpoints AND full UI with table, toggles, and dropdown
- User table columns: name, email, role dropdown, per-module toggle switches, last login timestamp
- Instant toggle behavior — click toggle or change dropdown, saves immediately (no separate save button)
- Admin can create new users from the admin panel — form with email + initial role, Supabase sends invite/password setup email
- Admin cannot edit their own role — row is visible but role dropdown is disabled (prevents self-lockout)

### Claude's Discretion
- Login card branding (logo/icon choice, "Glomalin" heading style)
- Session duration (reasonable default for a farm operations tool)
- Toast component styling and animation within the dark soil aesthetic
- Exact user menu dropdown design and placement
- Loading states and transitions between auth states

</decisions>

<specifics>
## Specific Ideas

- Admin panel scope shifted from Phase 26 to Phase 25 — this phase delivers the complete admin experience, Phase 26 focuses only on landing page, dashboard cards, and module shells
- Module access denial should name the specific module (not generic "that module") so users know exactly what they were trying to access
- Silent redirect for admin access denial is intentional — non-admins shouldn't even know the admin panel exists as a concept

</specifics>

<deferred>
## Deferred Ideas

- User signup/registration flow — explicitly out of scope per REQUIREMENTS.md; admin creates accounts
- User profile editing (change own email/password) — future phase
- Multi-factor authentication — future enhancement
- Audit logging of admin actions (role changes, access toggles) — future phase (AUD-01/02/03)

</deferred>

---

*Phase: 25-auth-middleware-route-protection*
*Context gathered: 2026-03-04*
