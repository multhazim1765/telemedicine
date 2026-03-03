# Offline-First Rural Telehealth & Smart Triage PWA

Production-focused PWA for Patient, Doctor, and Pharmacy workflows using React 18, TypeScript, Tailwind, Firebase, Cloud Functions, and Textbelt SMS.

## Implementation Order (Roadmap)

1. Bootstrap frontend (`Vite + React + TS + Tailwind`).
2. Configure Firebase app + Auth + Firestore offline persistence.
3. Define typed Firestore schema models.
4. Build agent modules (`triage`, `appointment`, `prescription`, `pharmacy`, `sync`).
5. Implement role-based routes and dashboards.
6. Add Firestore rules and role claims.
7. Add cloud function SMS integrations with Textbelt API key.
8. Add service worker and sync hooks.
9. Run tests for agents/services.
10. Deploy Hosting + Functions + Rules.

## Environment Setup

```bash
npm install
cp .env.example .env
```

Fill Firebase keys in `.env`.

## Firebase CLI Setup

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase functions:secrets:set TEXTBELT_API_KEY
```

Set user custom claims example:

```js
await admin.auth().setCustomUserClaims(uid, { role: "patient" });
```

## Development

```bash
npm run dev
```

Functions setup:

```bash
cd functions
npm install
npm run build
cd ..
```

## Testing

```bash
npm test
```

Includes:
- Basic unit tests for `triageAgent` and `appointmentAgent`
- Mock Firestore service test example

For free testing, you can set `TEXTBELT_API_KEY` to `textbelt`.

## Deploy

```bash
npm run build
firebase deploy --only hosting,firestore:rules,functions
```

## Low-Bandwidth Optimizations

- Firestore offline local persistence enabled.
- IndexedDB queue for deferred writes (`syncAgent`).
- Service worker static caching for shell-first load.
- Minimal responsive UI for low-end Android devices.
