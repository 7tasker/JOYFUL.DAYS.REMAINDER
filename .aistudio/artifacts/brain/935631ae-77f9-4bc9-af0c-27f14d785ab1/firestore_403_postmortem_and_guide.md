# JoyfulDays Postmortem & Knowledge Base: Firestore 403 Diagnostics & Resolution

## 1. Issue Summary

### Symptom
When updating the Remove Ads configuration (or changing ad pricing) from the administrative dashboard, the backend request failed with HTTP 500/403:
```json
{
  "error": {
    "code": 403,
    "message": "Missing or insufficient permissions.",
    "status": "PERMISSION_DENIED"
  }
}
```

### Context
- **Endpoint**: `POST /api/remove-ads/config`
- **Firestore Target Document**: `projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/settings/remove_ads`
- **Expected Behavior**: Verified administrator updates the configuration, changes persist to Firestore, get validated against Stripe and existing state, and effective settings update only upon verified persistence.

---

## 2. Root Cause Diagnostics

Three converging factors caused the permission failure and brittleness:

1. **Unauthenticated REST Writes vs. Strict Security Rules**:
   - Firestore security rules strictly require `request.auth != null && request.auth.token.admin == true` for any write to `/settings/{settingId}`.
   - The backend was initiating a REST `PATCH` request using only the API key (`?key=${FIREBASE_API_KEY}`) without an `Authorization: Bearer <token>` header.
   - Without an authorized admin bearer token, Firestore evaluates `request.auth` as `null`, immediately failing rules evaluation with `403 PERMISSION_DENIED`.

2. **Project & Service Account Context Boundary (Cloud Run vs. Firebase)**:
   - The Node.js application server runs in an AI Studio Cloud Run environment under project `ais-asia-east1-...`.
   - The Firebase Firestore database lives in the Firebase project `joyful-days` with custom named database `ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1`.
   - Application Default Credentials (ADC) from the local Cloud Run service account lacked cross-project IAM permissions (`datastore.databases.get/update`) on `joyful-days`, causing Admin SDK writes to fail without falling back cleanly to user-delegated admin identity.

3. **Client-Side Token Transmission Anti-Pattern**:
   - The frontend was sending an administrator Firebase ID token in the JSON payload body (`firebaseIdToken: fbIdToken`), rather than relying exclusively on standard HTTP authentication headers (`x-firebase-auth` / `Authorization`).
   - Body-level token parsing created confusion between application payload parameters and transport security credentials.

---

## 3. Resolution & Architectural Pattern

To permanently fix this module and ensure identical patterns are followed in other modules (AdMob, Gifting, Telemetry, Review Reminders), the following architecture was implemented:

### A. Dual-Layer Authenticated Persistence
1. **Tier 1 (Authorized Admin SDK)**: If an Admin SDK connection to the exact named database is authorized and available, it executes `db.collection("settings").doc("remove_ads").set(..., { merge: true })`.
2. **Tier 2 (Delegated Admin Identity via REST)**: When the Admin SDK is unprivileged in the host runtime, the backend securely extracts the verified admin bearer token from request headers (`x-firebase-auth` or `Authorization`) and executes an authenticated REST `PATCH` with `Authorization: Bearer <adminToken>`.
3. **Hard Denial of API-Key-Only Writes**: If neither Admin SDK nor verified administrator bearer token is present, the backend rejects the write with `403 Forbidden` upfront before touching Firestore.

### B. Header-Only Authentication
- Removed token transmission from JSON request bodies.
- The client `apiClient.ts` automatically attaches fresh Firebase ID tokens in `x-firebase-auth` headers alongside the admin session token in `Authorization`.
- The server extracts credentials exclusively from HTTP headers.

### C. Exact Named Database Targeting
- Both Admin SDK (`getFirestore(adminApp, firestoreDatabaseId)`) and REST operations explicitly target:
  `projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/...`
- Default database references (`(default)`) are never assumed.

### D. Clear Staging & Failure Differentiation
- Distinguishes between:
  1. `PERSISTENCE_FAILED`: Firestore write failed (returns HTTP 403 or 500, `persisted: false`).
  2. `VERIFICATION_FAILED`: Firestore write persisted successfully, but post-write read-back verification failed (returns HTTP 500, `persisted: true`).
- In-memory configuration state (`removeAdsConfigState`) is mutated **only** when both persistence and verification succeed.

### E. Stripe Price Consistency Verification
- Before writing to Firestore, the server checks the candidate `stripePriceId` against the intended `displayPrice` and `currency`.
- When live Stripe credentials are present, it retrieves the price object from Stripe and validates that it is active and matches the currency and amount in cents.

---

## 4. Checklist for Other Modules

When adding or updating endpoints in other modules (e.g. Gifting, Push Reminders, AdMob config):
- [ ] **Do NOT send tokens in JSON request bodies**. Use `authorizedFetch()` to populate `x-firebase-auth` / `Authorization`.
- [ ] **Target the exact named database**: Ensure `firestoreDatabaseId` is read from `firebase-applet-config.json`.
- [ ] **Require admin claim**: Ensure `firestore.rules` enforces `isAdmin()`.
- [ ] **Authenticate REST writes**: Never call Firestore REST endpoints with only `?key=...`. Always include `Authorization: Bearer <adminToken>`.
- [ ] **Perform read-back verification**: Read back the written document and verify fields match before updating in-memory cache.
