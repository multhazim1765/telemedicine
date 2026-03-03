# Frontend-Only UI Redesign (Backend/SMS Safe)

## What was kept unchanged

- API routes
- Backend business logic
- SMS gateway logic and trigger flow
- Authentication decision logic
- Database schema and triage logic

## Updated frontend folder structure

- src
  - components
    - layout
      - DashboardShell.tsx
      - Sidebar.tsx
      - TopNavbar.tsx
    - routes
      - RoleRoute.tsx
    - ui
      - AnimatedCounter.tsx
      - DashboardCard.tsx
      - Feedback.tsx
      - ToastProvider.tsx
    - DashboardLayout.tsx
    - ErrorBoundary.tsx
    - ProtectedRoute.tsx
  - features
    - superAdmin
      - SuperAdminLayout.tsx
      - SystemOverviewPage.tsx
      - UserManagementPage.tsx
      - HospitalManagementPage.tsx
      - PatientManagementPage.tsx
      - TriageRuleViewPage.tsx
      - MedicineDatabaseViewPage.tsx
      - SmsLogsViewPage.tsx
      - AnalyticsPage.tsx
      - LogsPage.tsx
      - SystemSettingsPage.tsx
      - SecurityPage.tsx
    - doctor
      - DoctorDashboard.tsx
    - pharmacy
      - PharmacyDashboard.tsx
    - patient
      - PatientDashboard.tsx
  - services
    - adminApi.ts
    - safeApi.ts

## UI/Theming

- Sidebar brand color: `#0E5C4A`
- Accent color: `#2BB673`
- Page background: `#F5F8FA`
- Soft white cards with rounded corners and minimal shadows
- Responsive fixed-left sidebar + top navbar + content area

## Reusable widgets

- `DashboardCard` for metric widgets
- `AnimatedCounter` for smooth stat animation
- Dashboard widgets for:
  - Total Patients
  - Active Doctors
  - Appointments Today
  - High Risk Cases
  - SMS Sent Today

## Charts (existing data only)

- Line chart: patient trend over time
- Pie chart: risk distribution
- Bar chart: medicine usage frequency

## Super Admin sections

- Overview
- User Management
- Hospital Management
- Triage Rule View (read-only)
- Medicine Database View (read-only)
- SMS Logs (read-only)
- Analytics
- System Settings
- Security

## Integration instructions (safe)

1. Pull latest frontend files only.
2. Run:
   - `npm install`
   - `npm run dev`
3. Keep backend and SMS modules untouched.
4. Verify role routes:
   - `/super-admin/*`
   - `/doctor/*`
   - `/pharmacy`
   - `/patient`
5. Verify existing API responses map to current UI fields before production deploy.
