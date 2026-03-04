# Changelog

All notable changes made to this project are documented in this file.

## [2026-03-04]

### Changed
- Redesigned authentication UI to a dark neon theme in `src/App.tsx` and `src/index.css`:
  - Added split login layout with left doctor illustration and right tabbed panel.
  - Added tabs: `[LOGIN]`, `[FACILITIES]`, `[DEMO ACCESS]` while preserving existing auth logic and handlers.
  - Added shared hover animations and glow effects for login controls.
  - Added new asset: `public/doctor-3d.svg`.
- Applied dark-neon styling across dashboard shell and shared UI primitives:
  - Updated `card`, `btn-primary`, `btn-muted`, and `input` styles.
  - Added scoped dashboard theme overrides for legacy utility classes used across pages.
  - Updated navbar/sidebar appearance and improved chart readability for dark backgrounds.
- Simplified super admin navigation in `src/features/superAdmin/SuperAdminLayout.tsx`:
  - Removed top categories bar to keep sidebar-only navigation.
- Improved navbar interactions in `src/components/layout/TopNavbar.tsx`:
  - Fixed non-working top actions with explicit button types.
  - Added working notifications dropdown.
  - Added outside-click handling for dropdown close behavior.
- Corrected sidebar icon mapping in `src/components/layout/Sidebar.tsx`:
  - Assigned distinct, semantically accurate icons per menu item.
  - Separated `Settings` and `Security` icons for clarity.

### Fixed
- Fixed intermittent blank page on refresh/tab switch by updating service worker strategy:
  - Updated `public/service-worker.js` and `src/pwa/serviceWorker.ts` to use safer navigation/network-first handling.
  - Added immediate activation and client claiming for faster SW updates.
  - Updated registration lifecycle in `src/pwa/registerServiceWorker.ts` to clear stale dev caches and request update checks in production.

### Validation
- Confirmed project builds successfully after all UI/PWA changes (`npm run -s build`).

## [2026-03-02]

### Added
- Added this `CHANGELOG.md` file to track updates.

### Security
- Ran dependency audit and remediation:
  - Executed `npm audit --json` and found 3 high-severity vulnerabilities in the React Router dependency chain.
  - Applied `npm audit fix`.
  - Verified clean result with `npm audit` (`0 vulnerabilities`).

### Changed
- Updated pharmacy stock behavior in `src/features/pharmacy/PharmacyDashboard.tsx`:
  - Corrected stock status logic so low quantity is not treated as out-of-stock.
  - Added explicit filtering behavior for stock states.
  - Finalized UI per request to keep only stock categories:
    - `All stock`
    - `In stock`
    - `Out of stock`
  - Removed low-stock category from both filter options and displayed status labels.
- Updated login screen layout in `src/App.tsx`:
  - Moved login-page switching into a dedicated sidebar panel for easier access.
  - Prevented login form squeeze by widening the auth container for sidebar mode.
  - Applied responsive split layout so the main form and sidebar both remain readable.

### Repository
- Initialized local Git repository and configured remote:
  - Remote: `https://github.com/multhazim1765/telemedicine.git`
- Resolved remote history conflict (`README.md`) during rebase and completed push.
- Pushed updates to `main`:
  - Commit: `acdaf78` — `Pharmacy: remove low stock state and filters`
  - Commit: `de29a52` — `Login: widen sidebar layout and add changelog`
