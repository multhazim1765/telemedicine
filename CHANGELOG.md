# Changelog

All notable changes made to this project are documented in this file.

## [2026-03-09]

### Added
- Added SMS booking desk route/page integration using `src/features/superAdmin/SmsBookingDeskPage.tsx` and updated super admin navigation to include SMS Booking access.
- Added Exotel inbound SMS webhook flow in `functions/src/index.ts` with Firestore persistence to `sms_bookings` and appointment creation pipeline.

### Changed
- Migrated booking terminology and data model from call booking to SMS booking across frontend/backend:
  - Updated `src/types/models.ts` and `src/types/firestoreCollections.ts` with `SmsBooking` and `sms_bookings` collection typing.
  - Updated `src/services/firestoreService.ts` seed and local/demo store handling to include `sms_bookings` and `ivr_menu_config`.
  - Updated routing in `src/App.tsx` to use `/super-admin/sms-booking` as the active booking desk entry.
- Updated doctor seed and catalog naming to align with provided doctor list and hospital management edits:
  - Refreshed doctor names in `src/data/doctors.json`.
  - Synced seeded doctor names in `functions/src/index.ts`.
- Updated SMS booking slot assignment logic in backend (`functions/src/index.ts`) to time-window based IST mapping:
  - `06:00-09:00 -> Morning`
  - `09:00-12:00 -> Afternoon`
  - `12:00-15:00 -> Evening`
- Updated SMS booking auto-sync behavior in `src/features/superAdmin/SmsBookingDeskPage.tsx`:
  - Prevents destructive mapping loss when doctors are added.
  - Auto-resequences priorities in strict order.

### Fixed
- Fixed doctor dashboard visibility for SMS-created appointments by aligning date filtering behavior so token/mobile records are visible for both SMS and web booking flows.
- Fixed hospital management doctor add flow to avoid accidental doctor ID collisions that could overwrite existing doctor records.
- Fixed duplicate SMS identifier handling in `functions/src/index.ts` by separating inbound booking message ID and outbound delivery message ID fields.

### Validation
- Verified successful builds after updates:
  - `npm run build`
  - `npm run build --prefix functions`

## [2026-03-07]

### Added
- Added district-wide pharmacy demo data in `src/data/demoPharmacies.ts`:
  - Generated one demo pharmacy account for each Tamil Nadu district.
  - Standardized pharmacy demo credentials to use the shared default password `am9790`.
- Added super admin pharmacy management in `src/features/superAdmin/PharmacyManagementPage.tsx`:
  - Added sidebar access for pharmacy administration.
  - Added demo-mode pharmacy create, edit, delete, search, and district grouping support.
- Added richer clinical decision persistence types in `src/types/models.ts`:
  - Added `ClinicalDecisionSummary` and related match/medicine summary types.
  - Extended consultation, prescription, and pharmacy request records to retain CDS context.

### Changed
- Reworked authentication flows in `src/App.tsx`:
  - Categorized login into three role tabs: `PATIENT`, `HOSPITAL`, and `PHARMACY`.
  - Added dedicated super admin login route/page at `/login/super-admin`.
  - Added `Super Admin Login` button under the login page logo panel.
  - Replaced the old landing experience with mascot-based loading/auth presentation.
  - Updated pharmacy login to follow the same district-filtered dropdown flow as hospital login.
- Updated hospital login UX to be fully filtered and role-specific:
  - Added district and hospital filters for hospital login.
  - Replaced manual identifier input with doctor selector dropdown formatted as `Doctor Name (DOCTOR_ID)`.
- Standardized patient/hospital shared login credential behavior:
  - Added managed shared password handling in `src/services/authService.ts`.
  - Added super admin control to edit shared patient/hospital password in `src/features/superAdmin/SecurityPage.tsx`.
- Updated hospital account generation in `src/data/hospitalDoctors.ts` to derive from catalog data with district metadata.
- Refreshed the application visual system across shared UI and dashboards:
  - Updated `src/index.css`, `src/config/theme.ts`, and shared layout components to use the Medway-inspired hospital styling.
  - Refined navbar, sidebar, cards, dashboard shell, and mascot loading states for the new frontend.
- Expanded pharmacy account handling in `src/services/authService.ts` and `src/services/firestoreService.ts`:
  - Preserved `pharmacyName` and `district` metadata in demo/local storage flows.
  - Merged seeded pharmacy demo users with stored demo users instead of overwriting local additions.
- Unified consultation and clinical decision support in `src/features/doctor/DoctorDashboard.tsx`:
  - Combined consultation form inputs with CDS evaluation and prescription drafting.
  - Persisted CDS-derived severity, risk, action, rule matches, and suggested medicines with saved consultation data.
- Expanded patient and pharmacy downstream records to retain full CDS context:
  - Updated `src/agents/pharmacyAgent.ts` and `src/services/functionService.ts` so pharmacy requests and SMS payloads include dosage, notes, review timing, CDS details, and prepared SMS content.
  - Updated `src/features/patient/PatientDashboard.tsx` so patients can view CDS context and resend the richer stored SMS message.

### Fixed
- Fixed patient dashboard scope in `src/features/patient/PatientDashboard.tsx` so patients only see hospitals/doctors from their own registered district.
- Fixed business date rollover behavior in `src/services/businessDateService.ts`:
  - Added auto/manual date mode handling.
  - Auto-resets stale manual dates to current system date once the stored date has passed.
  - Added periodic refresh subscription so date-bound UI stays current without manual intervention.
- Fixed blank loading and tab-transition states by moving auth/protected-route loading onto the mascot-based spinner in `src/components/ui/Feedback.tsx` and `src/components/ProtectedRoute.tsx`.

### Developer
- Updated and then cleaned up local VS Code task definitions in `.vscode/tasks.json` during the GitHub push workflow so only the intended task entries remain in the repository.

### Validation
- Verified successful production build after all updates (`npm run build`).

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
