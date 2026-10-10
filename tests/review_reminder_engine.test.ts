import assert from "assert";

// Test suite for JoyfulDays Backend Review Reminder Engine
async function runTests() {
  console.log("=== STARTING REVIEW REMINDER ENGINE INTEGRATION TESTS ===");
  const BASE_URL = "http://localhost:3000";

  // Helper for admin request
  const adminHeaders = {
    "Content-Type": "application/json",
    // We can test against public routes or test endpoints
  };

  // 1. Verify GET /api/reviews/config
  console.log("[Test 1] Testing GET /api/reviews/config...");
  const configRes = await fetch(`${BASE_URL}/api/reviews/config`);
  assert.strictEqual(configRes.status, 200, "Config endpoint must return 200");
  const configData = await configRes.json();
  assert.strictEqual(configData.success, true, "Config call must succeed");
  assert.ok(typeof configData.config.isEnabled === "boolean", "isEnabled must be boolean");
  assert.ok(typeof configData.config.retryCooldownHours === "number" || typeof configData.config.retryIntervalHours === "number", "retryCooldownHours must be a number");
  assert.ok(typeof configData.config.maxAttempts === "number" || typeof configData.config.maxReminderAttempts === "number", "maxAttempts must be a number");
  console.log("✔ Test 1 Passed: Configuration returns valid schema with cooldown and maxAttempts.");

  // 2. Verify unauthenticated GET /api/reviews/check-trigger is strictly REJECTED (401)
  console.log("[Test 2] Testing unauthenticated GET /api/reviews/check-trigger...");
  const unauthTriggerRes = await fetch(`${BASE_URL}/api/reviews/check-trigger?userId=test_user_1`);
  assert.strictEqual(unauthTriggerRes.status, 401, "Unauthenticated trigger check must return 401 Unauthorized");
  const unauthData = await unauthTriggerRes.json();
  assert.strictEqual(unauthData.code, "AUTH_REQUIRED", "Must specify AUTH_REQUIRED");
  console.log("✔ Test 2 Passed: Unauthenticated trigger checks are strictly blocked (401).");

  // 3. Verify unauthenticated POST /api/reviews/attempt is strictly REJECTED (401)
  console.log("[Test 3] Testing unauthenticated POST /api/reviews/attempt...");
  const unauthAttemptRes = await fetch(`${BASE_URL}/api/reviews/attempt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ triggerSource: "fcm" }),
  });
  assert.strictEqual(unauthAttemptRes.status, 401, "Unauthenticated attempt callback must return 401 Unauthorized");
  console.log("✔ Test 3 Passed: Unauthenticated attempt callback is strictly blocked (401).");

  // 4. Verify unauthenticated admin routes (POST /api/reviews/config, POST /api/reviews/trigger-push) are REJECTED (401/403)
  console.log("[Test 4] Testing unauthorized admin operations...");
  const unauthConfigPost = await fetch(`${BASE_URL}/api/reviews/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isEnabled: true }),
  });
  assert.ok([401, 403].includes(unauthConfigPost.status), "Unauthenticated config updates must be blocked");

  const unauthPush = await fetch(`${BASE_URL}/api/reviews/trigger-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "usr_1", fcmToken: "mock_token" }),
  });
  assert.ok([401, 403].includes(unauthPush.status), "Unauthenticated push trigger must be blocked");
  console.log("✔ Test 4 Passed: Admin routes strictly require administrative authentication.");

  // 5. Verify User State and Eligibility Endpoint: GET /api/reviews/user-state/:userId
  console.log("[Test 5] Testing GET /api/reviews/user-state/:userId...");
  const testUserId = `test-user-${Date.now()}`;
  const userStateRes = await fetch(`${BASE_URL}/api/reviews/user-state/${testUserId}`);
  assert.strictEqual(userStateRes.status, 200, "User state endpoint must return 200");
  const userStateData = await userStateRes.json();
  assert.strictEqual(userStateData.success, true, "User state call must succeed");
  assert.strictEqual(userStateData.reminderState.userId, testUserId);
  assert.strictEqual(userStateData.reminderState.attemptCount, 0, "Initial attemptCount must be 0");
  assert.strictEqual(userStateData.reminderState.status, "eligible", "Initial status must be eligible");
  assert.ok(typeof userStateData.eligibility.eligible === "boolean", "Eligibility boolean must exist");
  console.log("✔ Test 5 Passed: Initial per-user reminder state defaults to attemptCount=0, status=eligible.");

  // 6. Verify custom reviews submission: POST /api/reviews/submit (Must be preserved!)
  console.log("[Test 6] Testing preserved review submission POST /api/reviews/submit...");
  const submitReviewRes = await fetch(`${BASE_URL}/api/reviews/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: testUserId,
      userName: "Integration Test User",
      userEmail: "test@example.com",
      rating: 5,
      title: "Loved the celebration!",
      comment: "Smooth setup and easy gifting.",
      source: "google_play_in_app",
    }),
  });
  assert.strictEqual(submitReviewRes.status, 200, "Review submission must return 200");
  const submitData = await submitReviewRes.json();
  assert.strictEqual(submitData.success, true, "Review submission must succeed");
  assert.ok(submitData.reviewId, "ReviewId must be returned");
  console.log("✔ Test 6 Passed: Custom in-app feedback / user_reviews system preserved and functional.");

  // 7. Verify Admin Configuration Update with Admin Token
  console.log("[Test 7] Testing POST /api/reviews/config with signed Admin Token...");
  const adminPayload = {
    email: "admin@7tasker.com",
    role: "super_admin",
    iat: Date.now(),
    exp: Date.now() + 3600 * 1000,
    sessionId: "test-session-123",
  };
  const crypto = await import("crypto");
  const payloadB64 = Buffer.from(JSON.stringify(adminPayload)).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "jd_admin_secret_key_7tasker_935631ae_enterprise_sec").update(payloadB64).digest("base64url");
  const adminToken = `${payloadB64}.${signature}`;

  const updateConfigRes = await fetch(`${BASE_URL}/api/reviews/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      isEnabled: true,
      retryCooldownHours: 48,
      maxAttempts: 4,
    }),
  });
  assert.strictEqual(updateConfigRes.status, 200, "Admin config update must return 200");
  const updatedConfigData = await updateConfigRes.json();
  assert.strictEqual(updatedConfigData.success, true);
  assert.strictEqual(updatedConfigData.config.retryCooldownHours, 48);
  assert.strictEqual(updatedConfigData.config.maxAttempts, 4);
  console.log("✔ Test 7 Passed: Admin successfully updated and persisted config with cooldown=48h and maxAttempts=4.");

  // 8. Verify FCM trigger validation with missing / invalid token
  console.log("[Test 8] Testing FCM trigger error handling for missing/invalid tokens...");
  const fcmMissingTokenRes = await fetch(`${BASE_URL}/api/reviews/trigger-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: "non_existent_user_for_token_test",
      adminOverride: true,
    }),
  });
  assert.strictEqual(fcmMissingTokenRes.status, 400, "Missing token must return 400");
  const fcmMissingData = await fcmMissingTokenRes.json();
  assert.strictEqual(fcmMissingData.code, "MISSING_FCM_TOKEN", "Must return code MISSING_FCM_TOKEN");
  console.log("✔ Test 8 Passed: Missing FCM tokens are safely rejected with code MISSING_FCM_TOKEN.");

  // 9. Verify Admin Clear Queue Endpoint
  console.log("[Test 9] Testing POST /api/reviews/clear-queue with Admin Token...");
  const clearQueueRes = await fetch(`${BASE_URL}/api/reviews/clear-queue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminToken}`,
    },
  });
  assert.strictEqual(clearQueueRes.status, 200, "Clear queue must return 200");
  const clearQueueData = await clearQueueRes.json();
  assert.strictEqual(clearQueueData.success, true);
  console.log("✔ Test 9 Passed: Admin successfully cleared queued review triggers.");

  // 10. Verify Custom In-App Feedback Does NOT Block Google Play Reminder Eligibility
  console.log("[Test 10] Testing that custom user_reviews submission does NOT block Google Play reminder eligibility...");
  const feedbackUser = `usr-play-test-${Date.now()}`;
  // User submits custom review
  await fetch(`${BASE_URL}/api/reviews/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: feedbackUser,
      userName: "Google Play Separation Tester",
      rating: 5,
      comment: "In-app feedback submitted.",
    }),
  });
  // Check user eligibility
  const userCheckRes = await fetch(`${BASE_URL}/api/reviews/user-state/${feedbackUser}`);
  const userCheckData = await userCheckRes.json();
  assert.notStrictEqual(
    userCheckData.eligibility.reason,
    "USER_ALREADY_REVIEWED",
    "Custom in-app feedback submission MUST NOT block Google Play review reminder eligibility!"
  );
  console.log("✔ Test 10 Passed: Custom user_reviews submission does NOT suppress Google Play review reminders.");

  // 11. Verify Hardened Attempt Idempotency with attemptId UUID
  console.log("[Test 11] Testing hardened idempotency with attemptId UUID...");
  const testAttemptUser = `usr-attempt-test-${Date.now()}`;
  const attemptPayload = {
    email: "admin@7tasker.com",
    role: "super_admin",
    iat: Date.now(),
    exp: Date.now() + 3600 * 1000,
    sessionId: testAttemptUser,
  };
  const attemptUserB64 = Buffer.from(JSON.stringify(attemptPayload)).toString("base64url");
  const attemptUserSig = crypto.createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "jd_admin_secret_key_7tasker_935631ae_enterprise_sec").update(attemptUserB64).digest("base64url");
  const attemptUserToken = `${attemptUserB64}.${attemptUserSig}`;

  const firstAttemptId = `attempt-uuid-${Date.now()}-A`;

  // First call with firstAttemptId
  const firstAttemptRes = await fetch(`${BASE_URL}/api/reviews/attempt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${attemptUserToken}`,
    },
    body: JSON.stringify({
      attemptId: firstAttemptId,
      triggerSource: "event_created",
    }),
  });
  assert.strictEqual(firstAttemptRes.status, 200, "First attempt callback must return 200");
  const firstAttemptData = await firstAttemptRes.json();
  assert.strictEqual(firstAttemptData.reminderState.attemptCount, 1, "First attempt must increment attemptCount to 1");
  assert.strictEqual(firstAttemptData.reminderState.status, "cooldown", "Status must become cooldown");

  // Duplicate call with SAME firstAttemptId (e.g. Android network retry)
  const duplicateAttemptRes = await fetch(`${BASE_URL}/api/reviews/attempt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${attemptUserToken}`,
    },
    body: JSON.stringify({
      attemptId: firstAttemptId,
      triggerSource: "event_created",
    }),
  });
  assert.strictEqual(duplicateAttemptRes.status, 200, "Duplicate attempt callback must return 200");
  const duplicateAttemptData = await duplicateAttemptRes.json();
  assert.strictEqual(duplicateAttemptData.idempotent, true, "Duplicate attempt must be marked idempotent");
  assert.strictEqual(duplicateAttemptData.reminderState.attemptCount, 1, "Duplicate attemptId must NOT double increment!");
  console.log("✔ Test 11 Passed: Duplicate attemptId correctly recognized and does NOT double-increment.");

  // 12. Verify New attemptId Increments and Enforces Cooldown
  console.log("[Test 12] Testing new attemptId incrementation and cooldown enforcement...");
  const secondAttemptId = `attempt-uuid-${Date.now()}-B`;
  const secondAttemptRes = await fetch(`${BASE_URL}/api/reviews/attempt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${attemptUserToken}`,
    },
    body: JSON.stringify({
      attemptId: secondAttemptId,
      triggerSource: "fcm",
    }),
  });
  assert.strictEqual(secondAttemptRes.status, 200, "Second attempt callback must return 200");
  const secondAttemptData = await secondAttemptRes.json();
  assert.strictEqual(secondAttemptData.reminderState.attemptCount, 2, "Second attempt must increment attemptCount to 2");
  assert.strictEqual(secondAttemptData.reminderState.lastTriggerSource, "fcm");

  // Verify user is now in cooldown
  const cooldownCheckRes = await fetch(`${BASE_URL}/api/reviews/user-state/${testAttemptUser}`);
  const cooldownCheckData = await cooldownCheckRes.json();
  assert.strictEqual(cooldownCheckData.eligibility.eligible, false, "User in cooldown must not be eligible");
  assert.strictEqual(cooldownCheckData.eligibility.reason, "COOLDOWN_ACTIVE", "Reason must be COOLDOWN_ACTIVE");
  console.log("✔ Test 12 Passed: New attemptId increments exactly once and enforces COOLDOWN_ACTIVE.");

  console.log("\n=== ALL REVIEW REMINDER ENGINE INTEGRATION TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
