# Database Changes (Safe Extensions)

No existing SMS collections, routes, or controllers were modified.
No existing appointment APIs were modified.

## Added/Extended Frontend Data Contracts

- `users` collection added to typed frontend collection map (`FirestoreCollections`) for Super Admin UI.
- Existing collections remain unchanged.

## Demo Store Extension

- Added seeded `users` documents for demo mode:
  - `super_admin`
  - patient/pharmacy/demo hospital doctor accounts

## Integrity Notes

- Existing collections (`appointments`, `pharmacy_requests`, `prescriptions`) are not rewritten.
- Changes are additive and backward-compatible.
