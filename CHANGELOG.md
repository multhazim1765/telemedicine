# Changelog

All notable changes made to this project are documented in this file.

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

### Repository
- Initialized local Git repository and configured remote:
  - Remote: `https://github.com/multhazim1765/telemedicine.git`
- Resolved remote history conflict (`README.md`) during rebase and completed push.
- Pushed latest pharmacy change to `main`:
  - Commit: `acdaf78`
  - Message: `Pharmacy: remove low stock state and filters`
