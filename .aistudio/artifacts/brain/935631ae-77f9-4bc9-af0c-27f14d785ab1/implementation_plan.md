# JOYFULDAYS — Implementation Plan: Target Firestore Security Rules Fix

## Objective
Restore Android Cloud Sync by granting legitimate event owners read access to event collection groups (`isEventOwner(resource.data)`) and deleted-event subcollections (`isOwner(userId)`), while retaining full admin access (`isAdmin()`) to manage all users' events.

---

## 1. Targeted Rule Changes (`firestore.rules`)

### A. Collection-Group Event Access
* **File:** `firestore.rules`
* **Path:** `match /{path=**}/events/{eventId}`
* **Logic:**
```javascript
match /{path=**}/events/{eventId} {
  allow read: if isEventOwner(resource.data) || isAdmin();
}
```
* **Rationale:** Allows Android users to query event collections where they are the verified owner (`isEventOwner`), while retaining 100% admin read access across all users' events for dashboard management.

### B. User Subcollection Deleted-Events Sync
* **File:** `firestore.rules`
* **Path:** `match /users/{userId}/deleted_events/{eventId}`
* **Logic:**
```javascript
match /deleted_events/{eventId} {
  allow read, write: if isOwner(userId) || isAdmin();
}
```
* **Rationale:** Allows Android Cloud Sync to record and synchronize deleted event tombstones under the user's profile with admin override.

### C. Root Deleted-Events Fallback
* **File:** `firestore.rules`
* **Path:** `match /user_deleted_events/{userId}` & `match /deleted_events/{eventId}`
* **Logic:**
```javascript
match /user_deleted_events/{userId} {
  allow read, write: if isOwner(userId) || isAdmin();
}
match /deleted_events/{eventId} {
  allow read, write: if isEventOwner(resource.data) || 
                       (resource != null && isOwner(resource.data.userId)) || 
                       (request.resource != null && isOwner(request.resource.data.userId)) || 
                       isAdmin();
}
```

---

## 2. Preserved Security Controls

* **User Profile Creation:** Preserves `isUnprivilegedCreate()` allowing default unprivileged fields (`isPro: false`, `proStatus: "FREE"`, `role: "user"`) while blocking entitlement escalation.
* **Subcollections:** Retains existing `events`, `celebrations`, and `custom_holidays` rules.
* **Admin Dashboard:** Admins retain unhindered full read and write privileges across all collections.
* **AdMob & Config:** Retains existing settings permissions unchanged.

---

## 3. Validation & Deployment Steps

1. **Linting & Compile Check:** Run `npm run lint` and `npm run build` to ensure project validity.
2. **Logic Test Matrix:** Verify rule boolean evaluation across owner, admin, and unauthenticated test cases using Node logic evaluation.
3. **RPC Rule Deployment:** Deploy `firestore.rules` via `rpc_action` (`fax.DeployRules`) targeting named database `ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1`.
