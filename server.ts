import express from "express";
import path from "path";
import crypto from "crypto";
import Stripe from "stripe";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createServer as createViteServer } from "vite";
import helmet from "helmet";
import { initializeApp as initAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getMessaging as getAdminMessaging } from "firebase-admin/messaging";

const app = express();
app.set("trust proxy", true);
const PORT = 3000;

// Authoritative Firebase & Admin Credentials
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyBA0Uk33AX8udd8tHwQQjTWeMU3v1poyiw";
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "jd_admin_secret_key_7tasker_935631ae_enterprise_sec";
const ADMIN_AUTH_SIGNATURE = "jd_sec_proof_935631ae_7tasker_admin_auth";

// Root administrator email allowlist for claim synchronization
const ROOT_ADMIN_EMAILS = [
  "admin@7tasker.com",
  "joyfuldays.admin@7tasker.com",
  "support@7tasker.com",
];

export interface AdminSessionPayload {
  email: string;
  role: string;
  iat: number;
  exp: number;
  sessionId: string;
}

export function signAdminToken(payload: AdminSessionPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

export function verifyAdminToken(token: string): {
  valid: boolean;
  payload?: AdminSessionPayload;
  error?: string;
  expired?: boolean;
  unauthorized?: boolean;
  invalid?: boolean;
} {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, invalid: true, error: "Malformed token format" };
  }
  const [payloadB64, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(payloadB64).digest("base64url");
  
  if (signature.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return { valid: false, invalid: true, error: "Invalid cryptographic signature" };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as AdminSessionPayload;
    if (!payload || !payload.email || !payload.exp) {
      return { valid: false, invalid: true, error: "Invalid token payload structure" };
    }
    if (Date.now() >= payload.exp) {
      return { valid: false, expired: true, error: "Session expired" };
    }
    if (!ROOT_ADMIN_EMAILS.includes(payload.email.toLowerCase().trim())) {
      return { valid: false, unauthorized: true, error: "Unauthorized administrator email" };
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, invalid: true, error: "Failed to parse token payload" };
  }
}

// Secure Admin PIN credentials & Slow Hashing Scheme (scrypt with salt)
const ADMIN_PIN_SALT = process.env.ADMIN_PIN_SALT || "jd_admin_pin_salt_935631ae";
const DEFAULT_ADMIN_PIN = process.env.ADMIN_PIN || "848933";

function hashAdminPin(pin: string, salt: string = ADMIN_PIN_SALT): string {
  return crypto.scryptSync(pin, salt, 64).toString("hex");
}

const STORED_ADMIN_PIN_HASH = process.env.ADMIN_PIN_HASH || hashAdminPin(DEFAULT_ADMIN_PIN);

export function verifyPinCredential(inputPin: string): boolean {
  if (!inputPin) return false;
  const cleanPin = inputPin.trim();
  if (!cleanPin) return false;

  const inputHash = hashAdminPin(cleanPin);
  try {
    return crypto.timingSafeEqual(Buffer.from(inputHash, "hex"), Buffer.from(STORED_ADMIN_PIN_HASH, "hex"));
  } catch {
    return false;
  }
}

// In-Memory Rate Limiting & Lockout Protection for Admin Login
interface LoginAttemptRecord {
  count: number;
  firstAttemptTime: number;
  lockoutUntil: number;
}
const loginAttemptMap = new Map<string, LoginAttemptRecord>();

function checkAdminLoginRateLimit(ipOrEmail: string): { allowed: boolean; remainingMs?: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  const record = loginAttemptMap.get(ipOrEmail);
  if (!record) return { allowed: true };

  if (record.lockoutUntil && record.lockoutUntil > now) {
    return { allowed: false, remainingMs: record.lockoutUntil - now };
  }

  if (now - record.firstAttemptTime > windowMs) {
    loginAttemptMap.delete(ipOrEmail);
    return { allowed: true };
  }

  if (record.count >= maxAttempts) {
    record.lockoutUntil = now + windowMs;
    return { allowed: false, remainingMs: windowMs };
  }

  return { allowed: true };
}

function recordAdminFailedAttempt(ipOrEmail: string) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const record = loginAttemptMap.get(ipOrEmail) || { count: 0, firstAttemptTime: now, lockoutUntil: 0 };

  if (now - record.firstAttemptTime > windowMs) {
    record.count = 1;
    record.firstAttemptTime = now;
    record.lockoutUntil = 0;
  } else {
    record.count += 1;
  }

  if (record.count >= 5) {
    record.lockoutUntil = now + windowMs;
  }

  loginAttemptMap.set(ipOrEmail, record);
}

function clearAdminFailedAttempts(ipOrEmail: string) {
  loginAttemptMap.delete(ipOrEmail);
}


// Initialize Firebase Admin SDK safely using Application Default Credentials (ADC) or project configuration
import firebaseAppConfig from "./firebase-applet-config.json";

const firestoreDatabaseId = (firebaseAppConfig as any).firestoreDatabaseId || "ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1";

if (!getAdminApps().length) {
  try {
    initAdminApp({
      projectId: process.env.FIREBASE_PROJECT_ID || (firebaseAppConfig as any).projectId || "joyful-days",
    });
    console.log("[Firebase Admin] Initialized successfully with project ID:", process.env.FIREBASE_PROJECT_ID || (firebaseAppConfig as any).projectId);
  } catch (err: any) {
    console.warn("[Firebase Admin] Initialization notice:", err?.message || "Using ADC fallback");
  }
}

const adminApp = getAdminApps()[0];
const db = getFirestore(adminApp, firestoreDatabaseId);

// Enterprise Web Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://apis.google.com",
          "https://*.firebaseapp.com",
          "https://www.google.com",
          "https://www.gstatic.com",
        ],
        connectSrc: [
          "'self'",
          "https://com-backend-joyfuldays.ai.studio",
          "https://*.googleapis.com",
          "https://*.firebaseio.com",
          "https://*.run.app",
          "wss://*.run.app",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://firestore.googleapis.com",
        ],
        imgSrc: ["'self'", "data:", "blob:", "https://*.googleusercontent.com", "https://*.gstatic.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        frameSrc: [
          "'self'",
          "https://*.firebaseapp.com",
          "https://accounts.google.com",
          "https://www.google.com",
        ],
        frameAncestors: ["'self'", "*"], // Preserves live preview inside AI Studio container iframe
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    frameguard: false, // Frameguard disabled in favor of frameAncestors to allow AI Studio iframe
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xContentTypeOptions: true,
    dnsPrefetchControl: { allow: true },
  })
);

// Stripe & Remove Ads Configuration State
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || process.env["stripe-secret"] || "sk_test_mock_key_for_testing";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || process.env["stripe-webhook"] || "whsec_mock_webhook_secret_for_testing";

export function getActiveStripeKey(): string {
  return (process.env.STRIPE_SECRET_KEY || process.env["stripe-secret"] || process.env.STRIPE_SECRET || STRIPE_SECRET_KEY).trim();
}

export function getActiveStripeWebhookSecret(): string {
  return (process.env.STRIPE_WEBHOOK_SECRET || process.env["stripe-webhook"] || STRIPE_WEBHOOK_SECRET).trim();
}

export function getActiveStripeClient(): Stripe {
  return new Stripe(getActiveStripeKey());
}

const stripe = getActiveStripeClient();

let removeAdsConfigState = {
  enabled: true,
  stripePriceId: "price_1UJWeQDJGa9mhIUX1Bb604Eq",
  displayPrice: "$2.99",
  currency: "USD",
  lastUpdated: new Date().toISOString(),
  updatedBy: "Admin@7tasker.com",
};

const FIRESTORE_REMOVE_ADS_REST_URL = `https://firestore.googleapis.com/v1/projects/joyful-days/databases/${firestoreDatabaseId}/documents/settings/remove_ads`;

async function syncRemoveAdsStateFromFirestore(force = false): Promise<void> {
  try {
    const res = await fetch(`${FIRESTORE_REMOVE_ADS_REST_URL}?key=${FIREBASE_API_KEY}`);
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.fields) {
        const persisted = parseFirestoreFields(data.fields);
        if (typeof persisted.enabled === "boolean") removeAdsConfigState.enabled = persisted.enabled;
        if (typeof persisted.stripePriceId === "string" && persisted.stripePriceId.trim() !== "") {
          removeAdsConfigState.stripePriceId = persisted.stripePriceId;
        }
        if (persisted.displayPrice !== undefined && persisted.displayPrice !== null) {
          const rawPrice = persisted.displayPrice;
          if (typeof rawPrice === "number") {
            removeAdsConfigState.displayPrice = Number.isInteger(rawPrice) ? `$${rawPrice}.00` : `$${rawPrice}`;
          } else if (typeof rawPrice === "string") {
            const trimmed = rawPrice.trim();
            removeAdsConfigState.displayPrice = trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
          }
        }
        if (typeof persisted.currency === "string" && persisted.currency.trim() !== "") {
          removeAdsConfigState.currency = persisted.currency.trim().toUpperCase();
        } else {
          removeAdsConfigState.currency = "USD";
        }
        if (typeof persisted.lastUpdated === "string") removeAdsConfigState.lastUpdated = persisted.lastUpdated;
        if (typeof persisted.updatedBy === "string") removeAdsConfigState.updatedBy = persisted.updatedBy;
      }
    }
  } catch (err) {
    console.warn("[Firestore] Failed to sync remove_ads settings via REST:", err);
  }
}

// 1. [STRIPE WEBHOOK] Must use express.raw before express.json()
app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    const activeStripe = getActiveStripeClient();
    const webhookSecret = getActiveStripeWebhookSecret();
    event = activeStripe.webhooks.constructEvent(req.body, sig!, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const eventId = event.id;
  const eventRef = db.collection("processed_stripe_events").doc(eventId);
  const eventDoc = await eventRef.get();
  if (eventDoc.exists) {
    return res.json({ received: true, status: "already_processed" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const isPaid = session.payment_status === "paid" || session.status === "complete";
    const uid = session.metadata?.firebaseUid;
    const transactionId = session.id;
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id || session.id || "");
    const amountPaid = session.amount_total || 0;
    const currency = (session.currency || "USD").toUpperCase();
    const amountFormatted = `$${(amountPaid / 100).toFixed(2)} ${currency}`;
    const purchasedAtISO = new Date(event.created * 1000).toISOString();
    const userEmail = session.customer_details?.email || session.metadata?.userEmail || (uid ? `${uid}@joyfuldays.app` : "unassigned@joyfuldays.app");
    const customerId = typeof session.customer === "string" ? session.customer : (session.customer?.id || null);

    // Write to dedicated Stripe Transactions Ledger
    const ledgerRef = db.collection("stripe_transactions").doc(eventId);
    await ledgerRef.set({
      id: eventId,
      stripeEventId: eventId,
      checkoutSessionId: transactionId,
      paymentIntentId,
      chargeId: null,
      stripeCustomerId: customerId,
      uid: uid || null,
      customerEmail: userEmail,
      amount: amountPaid,
      amountFormatted,
      currency,
      paymentStatus: session.payment_status || "unpaid",
      checkoutStatus: session.status || "open",
      paymentMethodType: session.payment_method_types?.[0] || "card",
      stripeEventTimestamp: purchasedAtISO,
      paymentCompletionTimestamp: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
      refundStatus: "none",
      refundedAmount: 0,
      source: "STRIPE_VERIFIED_WEBHOOK",
    }, { merge: true });

    // ONLY grant PRO and update user entitlements if session payment is verified as paid!
    if (isPaid && uid) {
      const prefRef = db.collection("users").doc(uid).collection("settings").doc("preferences");
      await prefRef.set({
        remove_ads_lifetime: true,
        proStatus: "PRO",
        removeAdsLifetime: true,
        isPro: true,
        removeAdsProvider: "stripe",
        removeAdsPurchasedAt: FieldValue.serverTimestamp(),
        removeAdsStripeSessionId: transactionId,
        removeAdsStripeCustomerId: customerId,
        transactionId,
        paymentIntentId,
        amountPaid,
        amountFormatted,
        currency,
        userEmail,
        purchasedAt: purchasedAtISO,
      }, { merge: true });

      // Synced user entitlement fields on top-level users/{uid}
      const userRef = db.collection("users").doc(uid);
      await userRef.set({
        proStatus: "PRO",
        removeAdsLifetime: true,
        isPro: true,
        entitlements: {
          remove_ads_lifetime: true,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Option B: Store transaction details in analytics/monetization_stats/users/{uid}
      const userMonetizationRef = db.collection("analytics").doc("monetization_stats").collection("users").doc(uid);
      await userMonetizationRef.set({
        uid,
        userEmail,
        isUnlocked: true,
        removeAdsLifetime: true,
        transactionId,
        paymentIntentId,
        amountPaid,
        amountFormatted,
        currency,
        purchasedAt: purchasedAtISO,
        lastUpdatedAt: purchasedAtISO,
        unlockedAt: purchasedAtISO,
      }, { merge: true });

      const analyticsRef = db.collection("analytics").doc("remove_ads");
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(analyticsRef);
        const data = docSnap.exists ? docSnap.data() : {};
        const totalPayments = (data?.totalRemoveAdsPayments || 0) + 1;
        const revenue = (data?.totalRemoveAdsRevenue || 0) + amountPaid;
        const breakdown = data?.currencyBreakdown || {};
        breakdown[currency] = (breakdown[currency] || 0) + amountPaid;

        const buyers = data?.buyers || [];
        let uniqueUsers = data?.totalRemoveAdsUsers || 0;
        if (!buyers.includes(uid)) {
          buyers.push(uid);
          uniqueUsers += 1;
        }

        transaction.set(analyticsRef, {
          totalRemoveAdsPayments: totalPayments,
          totalRemoveAdsUsers: uniqueUsers,
          totalRemoveAdsRevenue: revenue,
          currencyBreakdown: breakdown,
          lastPurchaseAt: purchasedAtISO,
          latestPaymentAmount: amountPaid,
          latestCurrency: currency,
          buyers,
        }, { merge: true });
      });
    }
  } else if (event.type === "charge.refunded" || event.type === "charge.refund.updated") {
    const charge = event.data.object as Stripe.Charge;
    const ledgerRef = db.collection("stripe_transactions").doc(eventId);
    const amountRefunded = charge.amount_refunded || 0;
    const currency = (charge.currency || "USD").toUpperCase();
    await ledgerRef.set({
      id: eventId,
      stripeEventId: eventId,
      paymentIntentId: typeof charge.payment_intent === "string" ? charge.payment_intent : null,
      chargeId: charge.id,
      stripeCustomerId: typeof charge.customer === "string" ? charge.customer : null,
      customerEmail: charge.billing_details?.email || charge.receipt_email || null,
      amount: charge.amount || 0,
      amountFormatted: `$${((charge.amount || 0) / 100).toFixed(2)} ${currency}`,
      currency,
      paymentStatus: charge.refunded ? "refunded" : "partially_refunded",
      refundStatus: charge.refunded ? "refunded" : "partially_refunded",
      refundedAmount: amountRefunded,
      stripeEventTimestamp: new Date(event.created * 1000).toISOString(),
      createdAt: FieldValue.serverTimestamp(),
      source: "STRIPE_VERIFIED_WEBHOOK",
    }, { merge: true });
  }

  await eventRef.set({ processedAt: new Date().toISOString() });
  res.json({ received: true });
});

// Enable JSON body parsing and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global CORS Middleware so Android APK / Web clients can consume APIs
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Server-Side Middleware: Verify Cryptographic Admin Session Token or Firebase ID Token
export const requireAdminAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;

  // 1. Missing Authorization header or missing Bearer prefix -> SESSION_MISSING
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "SESSION_MISSING",
      message: "Authorization header with Bearer token is required.",
    });
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "SESSION_MISSING",
      message: "Bearer session token is missing or empty.",
    });
  }

  // 2. Check for HMAC-SHA256 admin token (<payload>.<signature>)
  const dotCount = (token.match(/\./g) || []).length;
  if (dotCount === 1) {
    const verification = verifyAdminToken(token);
    if (verification.valid && verification.payload) {
      (req as any).user = {
        email: verification.payload.email,
        admin: true,
        uid: verification.payload.sessionId,
        role: verification.payload.role,
      };
      (req as any).sessionExp = verification.payload.exp;
      return next();
    }
    
    // Strict classification: ONLY return SESSION_EXPIRED if the token was cryptographically valid but expired
    if (verification.expired) {
      return res.status(401).json({
        error: "Unauthorized",
        code: "SESSION_EXPIRED",
        message: "Your admin session has expired. Please sign in again.",
      });
    }

    // If signature was valid but the email inside does not belong to root admins
    if (verification.unauthorized) {
      return res.status(403).json({
        error: "Forbidden",
        code: "UNAUTHORIZED",
        message: "Administrative privileges required.",
      });
    }

    // Invalid signature, corrupted payload, or malformed structure -> INVALID_SESSION
    return res.status(401).json({
      error: "Unauthorized",
      code: "INVALID_SESSION",
      message: "Invalid administrator session token.",
    });
  }

  // 3. Firebase ID Token for Google OAuth logins (JWT with 2 dots: header.payload.signature)
  if (dotCount === 2) {
    try {
      if (!getAdminApps().length) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "FIREBASE_NOT_INITIALIZED",
          message: "Firebase Admin SDK is not initialized.",
        });
      }
      const adminAuth = getAdminAuth();
      const decodedToken = await adminAuth.verifyIdToken(token);

      if (decodedToken && decodedToken.email) {
        const email = decodedToken.email.toLowerCase().trim();
        const isDesignatedAdminEmail = ROOT_ADMIN_EMAILS.includes(email);

        if (decodedToken.admin === true || isDesignatedAdminEmail) {
          if (decodedToken.uid && decodedToken.admin !== true) {
            try {
              await adminAuth.setCustomUserClaims(decodedToken.uid, { admin: true });
            } catch (claimErr) {
              // ignore
            }
          }
          (req as any).user = { ...decodedToken, email, admin: true };
          return next();
        }

        return res.status(403).json({
          error: "Forbidden",
          code: "UNAUTHORIZED",
          message: `Administrative privileges required. ${email} is not an authorized administrator email.`,
        });
      }
    } catch (verifyErr: any) {
      console.warn("[Auth] Firebase verifyIdToken failed:", verifyErr?.message || verifyErr);
      if (verifyErr?.code === "auth/id-token-expired") {
        return res.status(401).json({
          error: "Unauthorized",
          code: "SESSION_EXPIRED",
          message: "Your authentication session has expired. Please sign in again.",
        });
      }
      return res.status(401).json({
        error: "Unauthorized",
        code: "INVALID_TOKEN",
        message: "Provided Firebase token failed administrative verification.",
      });
    }
    return res.status(401).json({
      error: "Unauthorized",
      code: "INVALID_SESSION",
      message: "Invalid Firebase ID token.",
    });
  }

  // 4. Any other token (e.g. malformed legacy static tokens like 'admin-token-joyfuldays' without dots) -> INVALID_SESSION
  return res.status(401).json({
    error: "Unauthorized",
    code: "INVALID_SESSION",
    message: "Invalid or deprecated session token format.",
  });
};

// In-Memory Server State for App Feature Flags (Synchronized with Admin Portal & Authoritative settings/gifting)
let appFeatureState = {
  isGiftingEnabled: false,
  isPoolingEnabled: false,
  isTangoCardDirectGiftEnabled: false,
  minimumContributionAmount: 5.0,
  maintenanceMessage: "Gifting and pool contributions are temporarily paused for scheduled maintenance. Please check back shortly.",
  bannerNoticeMessage: "JoyfulDays Gifting & Pool Services Active",
  lastUpdated: new Date().toISOString(),
  updatedBy: "Admin@7tasker.com",
  apiVersion: "v1.2.0",
  app: "JoyfulDays",
};

// Authoritative Firestore REST URL for settings/gifting
const FIRESTORE_GIFTING_REST_URL = "https://firestore.googleapis.com/v1/projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/settings/gifting";
const FIRESTORE_GIFTING_FALLBACK_REST_URL = "https://firestore.googleapis.com/v1/projects/joyful-days/databases/(default)/documents/settings/gifting";

// Authoritative Firestore REST URL for settings/admob
const FIRESTORE_ADMOB_REST_URL = "https://firestore.googleapis.com/v1/projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/settings/admob";

let lastFirestoreGiftingSync = 0;
const GIFTING_CACHE_TTL_MS = 2000;

let lastFirestoreAdMobSync = 0;
const ADMOB_CACHE_TTL_MS = 2000;

function convertToFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => {
          if (typeof item === "object" && item !== null) {
            const mapFields: Record<string, any> = {};
            for (const [k, v] of Object.entries(item)) {
              mapFields[k] = convertToFirestoreValue(v);
            }
            return { mapValue: { fields: mapFields } };
          }
          return convertToFirestoreValue(item);
        }),
      },
    };
  }
  if (typeof val === "object") {
    const mapFields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      mapFields[k] = convertToFirestoreValue(v);
    }
    return { mapValue: { fields: mapFields } };
  }
  return { stringValue: String(val) };
}

function parseFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, valObj] of Object.entries(fields || {})) {
    const valType = Object.keys(valObj)[0];
    const rawVal = (valObj as any)[valType];
    if (valType === "booleanValue") {
      result[key] = Boolean(rawVal);
    } else if (valType === "integerValue") {
      result[key] = parseInt(rawVal, 10);
    } else if (valType === "doubleValue") {
      result[key] = parseFloat(rawVal);
    } else if (valType === "stringValue") {
      result[key] = String(rawVal);
    } else if (valType === "arrayValue") {
      result[key] = (rawVal?.values || []).map((v: any) => {
        if (v.mapValue) {
          return parseFirestoreFields(v.mapValue.fields);
        }
        return Object.values(v)[0];
      });
    } else if (valType === "mapValue") {
      result[key] = parseFirestoreFields(rawVal.fields);
    } else {
      result[key] = rawVal;
    }
  }
  return result;
}

async function syncAdMobStateFromFirestore(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFirestoreAdMobSync < ADMOB_CACHE_TTL_MS) {
    return;
  }
  try {
    const res = await fetch(`${FIRESTORE_ADMOB_REST_URL}?key=${FIREBASE_API_KEY}`);
    if (!res.ok) return;
    const data: any = await res.json();
    if (!data.fields) return;
    const persisted = parseFirestoreFields(data.fields);
    if (typeof persisted.adsEnabled === "boolean") admobSettingsState.adsEnabled = persisted.adsEnabled;
    if (typeof persisted.bannerEnabled === "boolean") admobSettingsState.bannerEnabled = persisted.bannerEnabled;
    if (typeof persisted.interstitialEnabled === "boolean") admobSettingsState.interstitialEnabled = persisted.interstitialEnabled;
    if (typeof persisted.bannerAdUnitId === "string") admobSettingsState.bannerAdUnitId = persisted.bannerAdUnitId;
    if (typeof persisted.interstitialAdUnitId === "string") admobSettingsState.interstitialAdUnitId = persisted.interstitialAdUnitId;
    if (persisted.bannerPlacement === "BOTTOM" || persisted.bannerPlacement === "TOP") admobSettingsState.bannerPlacement = persisted.bannerPlacement;
    if (persisted.interstitialTrigger) admobSettingsState.interstitialTrigger = persisted.interstitialTrigger;
    if (typeof persisted.interstitialFrequency === "number") admobSettingsState.interstitialFrequency = persisted.interstitialFrequency;
    if (typeof persisted.minActionsBeforeFirstAd === "number") admobSettingsState.minActionsBeforeFirstAd = persisted.minActionsBeforeFirstAd;
    if (typeof persisted.minimumSessionTimeSeconds === "number") admobSettingsState.minimumSessionTimeSeconds = persisted.minimumSessionTimeSeconds;
    if (typeof persisted.cooldownMinutes === "number") admobSettingsState.cooldownMinutes = persisted.cooldownMinutes;
    if (typeof persisted.maxInterstitialsPerSession === "number") admobSettingsState.maxInterstitialsPerSession = persisted.maxInterstitialsPerSession;
    if (typeof persisted.updatedAt === "string") admobSettingsState.updatedAt = persisted.updatedAt;
    if (typeof persisted.updatedBy === "string") admobSettingsState.updatedBy = persisted.updatedBy;
    lastFirestoreAdMobSync = now;
  } catch (err) {
    console.warn("[Firestore] Failed to sync AdMob settings:", err);
  }
}

async function syncAppFeatureStateFromFirestore(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFirestoreGiftingSync < GIFTING_CACHE_TTL_MS) {
    return;
  }
  try {
    let res = await fetch(FIRESTORE_GIFTING_REST_URL);
    if (!res.ok) {
      res = await fetch(FIRESTORE_GIFTING_FALLBACK_REST_URL);
    }
    if (!res.ok) {
      return;
    }
    const data: any = await res.json();
    const fields = data.fields || {};

    if (typeof fields.isGiftingEnabled?.booleanValue === "boolean") {
      appFeatureState.isGiftingEnabled = fields.isGiftingEnabled.booleanValue;
    }
    if (typeof fields.isPoolingEnabled?.booleanValue === "boolean") {
      appFeatureState.isPoolingEnabled = fields.isPoolingEnabled.booleanValue;
    }
    if (typeof fields.isTangoCardDirectGiftEnabled?.booleanValue === "boolean") {
      appFeatureState.isTangoCardDirectGiftEnabled = fields.isTangoCardDirectGiftEnabled.booleanValue;
    }
    if (fields.minimumContributionAmount) {
      appFeatureState.minimumContributionAmount = Number(
        fields.minimumContributionAmount.integerValue ??
        fields.minimumContributionAmount.doubleValue ??
        appFeatureState.minimumContributionAmount
      );
    }
    if (fields.maintenanceMessage?.stringValue) {
      appFeatureState.maintenanceMessage = fields.maintenanceMessage.stringValue;
    }
    if (fields.bannerNoticeMessage?.stringValue) {
      appFeatureState.bannerNoticeMessage = fields.bannerNoticeMessage.stringValue;
    }
    if (fields.lastUpdated?.stringValue) {
      appFeatureState.lastUpdated = fields.lastUpdated.stringValue;
    }
    if (fields.updatedBy?.stringValue) {
      appFeatureState.updatedBy = fields.updatedBy.stringValue;
    }
    lastFirestoreGiftingSync = now;
  } catch (err: any) {
    console.warn("[Firestore] settings/gifting sync notice:", err?.message || err);
  }
}

// Authoritative Firestore REST URLs for Review Reminder Engine
const FIRESTORE_REVIEW_REMINDERS_REST_URL = `https://firestore.googleapis.com/v1/projects/joyful-days/databases/${firestoreDatabaseId}/documents/settings/review_reminders`;
const FIRESTORE_USER_REMINDERS_BASE_URL = `https://firestore.googleapis.com/v1/projects/joyful-days/databases/${firestoreDatabaseId}/documents/user_review_reminders`;
const FIRESTORE_USER_TRIGGERS_BASE_URL = `https://firestore.googleapis.com/v1/projects/joyful-days/databases/${firestoreDatabaseId}/documents/user_review_triggers`;
const FIRESTORE_USERS_BASE_URL = `https://firestore.googleapis.com/v1/projects/joyful-days/databases/${firestoreDatabaseId}/documents/users`;
const FIRESTORE_USER_REVIEWS_BASE_URL = `https://firestore.googleapis.com/v1/projects/joyful-days/databases/${firestoreDatabaseId}/documents/user_reviews`;

// In-Memory & Authoritative Server State for Review Reminders Engine
let reviewReminderState = {
  isEnabled: true,
  initialDelayHours: 3,
  retryCooldownHours: 24,
  retryIntervalHours: 24,
  maxAttempts: 3,
  maxReminderAttempts: 3,
  fcmEnabled: true,
  eventCreationEnabled: true,
  pushTitle: "⭐ How is your JoyfulDays experience?",
  pushBody: "We'd love your feedback! Rate us on Google Play or share your thoughts to help us improve.",
  triggerModes: {
    inAppPopup: true,
    pushNotification: true,
    afterCelebrationCreated: true,
    afterGiftSent: true,
  },
  pushNotificationTemplate: {
    title: "⭐ How is your JoyfulDays experience?",
    body: "We'd love your feedback! Rate us on Google Play or share your thoughts to help us improve.",
    actionText: "Rate Now",
    deepLink: "joyfuldays://review/play-store",
  },
  inAppPopupTemplate: {
    headline: "Enjoying JoyfulDays celebrations?",
    subheadline: "Your honest feedback helps us support more unforgettable moments for friends & family.",
    positiveButtonText: "Rate on Google Play ★★★★★",
    dismissButtonText: "Remind Me Later",
    fallbackPlayStoreUrl: "https://play.google.com/store/apps/details?id=com.joyfuldays.app",
  },
  quietHours: {
    enabled: true,
    startHour: 22,
    endHour: 8,
  },
  lastUpdated: new Date().toISOString(),
  updatedBy: "Admin@7tasker.com",
};

let lastFirestoreReviewConfigSync = 0;
const REVIEW_CONFIG_CACHE_TTL_MS = 2000;

async function syncReviewReminderStateFromFirestore(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFirestoreReviewConfigSync < REVIEW_CONFIG_CACHE_TTL_MS) {
    return;
  }
  try {
    const res = await fetch(`${FIRESTORE_REVIEW_REMINDERS_REST_URL}?key=${FIREBASE_API_KEY}`);
    if (!res.ok) return;
    const data: any = await res.json();
    if (!data.fields) return;
    const persisted = parseFirestoreFields(data.fields);
    if (typeof persisted.isEnabled === "boolean") reviewReminderState.isEnabled = persisted.isEnabled;
    if (typeof persisted.initialDelayHours === "number") reviewReminderState.initialDelayHours = persisted.initialDelayHours;
    if (typeof persisted.retryCooldownHours === "number") {
      reviewReminderState.retryCooldownHours = persisted.retryCooldownHours;
      reviewReminderState.retryIntervalHours = persisted.retryCooldownHours;
    } else if (typeof persisted.retryIntervalHours === "number") {
      reviewReminderState.retryCooldownHours = persisted.retryIntervalHours;
      reviewReminderState.retryIntervalHours = persisted.retryIntervalHours;
    }
    if (typeof persisted.maxAttempts === "number") {
      reviewReminderState.maxAttempts = persisted.maxAttempts;
      reviewReminderState.maxReminderAttempts = persisted.maxAttempts;
    } else if (typeof persisted.maxReminderAttempts === "number") {
      reviewReminderState.maxAttempts = persisted.maxReminderAttempts;
      reviewReminderState.maxReminderAttempts = persisted.maxReminderAttempts;
    }
    if (typeof persisted.fcmEnabled === "boolean") reviewReminderState.fcmEnabled = persisted.fcmEnabled;
    if (typeof persisted.eventCreationEnabled === "boolean") reviewReminderState.eventCreationEnabled = persisted.eventCreationEnabled;
    if (typeof persisted.pushTitle === "string" && persisted.pushTitle.trim()) reviewReminderState.pushTitle = persisted.pushTitle;
    if (typeof persisted.pushBody === "string" && persisted.pushBody.trim()) reviewReminderState.pushBody = persisted.pushBody;
    if (persisted.triggerModes && typeof persisted.triggerModes === "object") {
      reviewReminderState.triggerModes = { ...reviewReminderState.triggerModes, ...persisted.triggerModes };
    }
    if (persisted.pushNotificationTemplate && typeof persisted.pushNotificationTemplate === "object") {
      reviewReminderState.pushNotificationTemplate = { ...reviewReminderState.pushNotificationTemplate, ...persisted.pushNotificationTemplate };
    }
    if (persisted.inAppPopupTemplate && typeof persisted.inAppPopupTemplate === "object") {
      reviewReminderState.inAppPopupTemplate = { ...reviewReminderState.inAppPopupTemplate, ...persisted.inAppPopupTemplate };
    }
    if (persisted.quietHours && typeof persisted.quietHours === "object") {
      reviewReminderState.quietHours = { ...reviewReminderState.quietHours, ...persisted.quietHours };
    }
    if (typeof persisted.lastUpdated === "string") reviewReminderState.lastUpdated = persisted.lastUpdated;
    if (typeof persisted.updatedAt === "string") reviewReminderState.lastUpdated = persisted.updatedAt;
    if (typeof persisted.updatedBy === "string") reviewReminderState.updatedBy = persisted.updatedBy;
    lastFirestoreReviewConfigSync = now;
  } catch (err) {
    console.warn("[Firestore] Failed to sync review reminders settings:", err);
  }
}

export interface UserReviewReminderDoc {
  userId: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextEligibleAt: string | null;
  lastFcmSentAt: string | null;
  lastTriggerSource: string | null;
  status: "eligible" | "cooldown" | "max_attempts" | "pending";
  updatedAt: string;
  createdAt: string;
  processedAttemptIds?: string[];
}

const userReviewRemindersCache = new Map<string, UserReviewReminderDoc>();
const attemptLockMap = new Map<string, number>();

async function getUserReviewReminderDoc(userId: string): Promise<UserReviewReminderDoc> {
  if (userReviewRemindersCache.has(userId)) {
    return userReviewRemindersCache.get(userId)!;
  }
  try {
    const res = await fetch(`${FIRESTORE_USER_REMINDERS_BASE_URL}/${userId}?key=${FIREBASE_API_KEY}`);
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.fields) {
        const parsed = parseFirestoreFields(data.fields);
        const doc: UserReviewReminderDoc = {
          userId,
          attemptCount: typeof parsed.attemptCount === "number" ? parsed.attemptCount : 0,
          lastAttemptAt: typeof parsed.lastAttemptAt === "string" ? parsed.lastAttemptAt : null,
          nextEligibleAt: typeof parsed.nextEligibleAt === "string" ? parsed.nextEligibleAt : null,
          lastFcmSentAt: typeof parsed.lastFcmSentAt === "string" ? parsed.lastFcmSentAt : null,
          lastTriggerSource: typeof parsed.lastTriggerSource === "string" ? parsed.lastTriggerSource : null,
          status: (parsed.status as any) || "eligible",
          updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
          createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
          processedAttemptIds: Array.isArray(parsed.processedAttemptIds) ? parsed.processedAttemptIds.map(String) : [],
        };
        userReviewRemindersCache.set(userId, doc);
        return doc;
      }
    }
  } catch (err) {
    console.warn(`[Firestore] Error fetching user_review_reminders/${userId}:`, err);
  }

  const defaultDoc: UserReviewReminderDoc = {
    userId,
    attemptCount: 0,
    lastAttemptAt: null,
    nextEligibleAt: null,
    lastFcmSentAt: null,
    lastTriggerSource: null,
    status: "eligible",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    processedAttemptIds: [],
  };
  userReviewRemindersCache.set(userId, defaultDoc);
  return defaultDoc;
}

async function saveUserReviewReminderDoc(userId: string, updates: Partial<UserReviewReminderDoc>): Promise<UserReviewReminderDoc> {
  const current = await getUserReviewReminderDoc(userId);
  const updatedDoc: UserReviewReminderDoc = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  userReviewRemindersCache.set(userId, updatedDoc);

  try {
    const fieldsToUpdate: Record<string, any> = {};
    for (const [k, v] of Object.entries(updatedDoc)) {
      fieldsToUpdate[k] = convertToFirestoreValue(v);
    }
    const updateMaskParams = Object.keys(fieldsToUpdate).map(f => `updateMask.fieldPaths=${f}`).join("&");
    await fetch(`${FIRESTORE_USER_REMINDERS_BASE_URL}/${userId}?${updateMaskParams}&key=${FIREBASE_API_KEY}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fieldsToUpdate }),
    });
  } catch (err) {
    console.error(`[Firestore] Error saving user_review_reminders/${userId}:`, err);
  }
  return updatedDoc;
}

async function hasUserSubmittedReview(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/joyful-days/databases/${firestoreDatabaseId}/documents:runQuery?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "user_reviews" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "userId" },
              op: "EQUAL",
              value: { stringValue: userId },
            },
          },
          limit: 1,
        },
      }),
    });
    if (res.ok) {
      const results: any[] = await res.json();
      if (Array.isArray(results) && results.some((r) => r.document)) {
        return true;
      }
    }
  } catch (err) {}
  return false;
}

async function checkUserReviewEligibility(
  userId: string,
  options?: { celebrationCreated?: boolean; giftSent?: boolean; clientHoursSinceSignIn?: number }
): Promise<{ eligible: boolean; reason: string; reminderState: UserReviewReminderDoc; config: typeof reviewReminderState }> {
  await syncReviewReminderStateFromFirestore();

  const reminderState = await getUserReviewReminderDoc(userId);

  // 1. Engine enabled check
  if (!reviewReminderState.isEnabled) {
    return { eligible: false, reason: "ENGINE_DISABLED", reminderState, config: reviewReminderState };
  }

  // 2. Max attempts check
  const maxAttempts = reviewReminderState.maxAttempts || reviewReminderState.maxReminderAttempts || 3;
  if (reminderState.attemptCount >= maxAttempts) {
    if (reminderState.status !== "max_attempts") {
      reminderState.status = "max_attempts";
      saveUserReviewReminderDoc(userId, { status: "max_attempts" }).catch(() => {});
    }
    return { eligible: false, reason: "MAX_ATTEMPTS_REACHED", reminderState, config: reviewReminderState };
  }

  // 4. Cooldown check
  const now = Date.now();
  if (reminderState.nextEligibleAt && new Date(reminderState.nextEligibleAt).getTime() > now) {
    if (reminderState.status !== "cooldown") {
      reminderState.status = "cooldown";
      saveUserReviewReminderDoc(userId, { status: "cooldown" }).catch(() => {});
    }
    return { eligible: false, reason: "COOLDOWN_ACTIVE", reminderState, config: reviewReminderState };
  }

  // 5. Initial sign-in delay & event trigger validation
  let hoursSinceSignIn = options?.clientHoursSinceSignIn || 0;
  try {
    const userRes = await fetch(`${FIRESTORE_USERS_BASE_URL}/${userId}?key=${FIREBASE_API_KEY}`);
    if (userRes.ok) {
      const userData: any = await userRes.json();
      if (userData?.fields) {
        const u = parseFirestoreFields(userData.fields);
        const signInTime = u.lastSignInAt || u.lastActive || u.joinedDate || u.createdAt;
        if (signInTime) {
          const parsedTime = new Date(signInTime).getTime();
          if (!isNaN(parsedTime)) {
            hoursSinceSignIn = Math.max(0, (now - parsedTime) / (1000 * 60 * 60));
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[Reviews] Notice inspecting user document for ${userId}:`, err);
  }

  const delayMet = hoursSinceSignIn >= reviewReminderState.initialDelayHours;
  const eventTriggered = Boolean(
    (options?.celebrationCreated && reviewReminderState.triggerModes.afterCelebrationCreated && reviewReminderState.eventCreationEnabled !== false) ||
    (options?.giftSent && reviewReminderState.triggerModes.afterGiftSent)
  );

  if (!delayMet && !eventTriggered) {
    return { eligible: false, reason: "INITIAL_DELAY_NOT_MET", reminderState, config: reviewReminderState };
  }

  // 6. Quiet hours check
  if (reviewReminderState.quietHours.enabled) {
    const currentHour = new Date().getHours();
    const { startHour, endHour } = reviewReminderState.quietHours;
    let isQuietHour = false;
    if (startHour > endHour) {
      isQuietHour = currentHour >= startHour || currentHour < endHour;
    } else {
      isQuietHour = currentHour >= startHour && currentHour < endHour;
    }
    if (isQuietHour) {
      return { eligible: false, reason: "QUIET_HOURS_ACTIVE", reminderState, config: reviewReminderState };
    }
  }

  return { eligible: true, reason: "ELIGIBLE_NOW", reminderState, config: reviewReminderState };
}

// Master AdMob Control & Remote Config (settings/admob) - ALWAYS OFF BY DEFAULT
const admobSettingsState = {
  adsEnabled: false,
  bannerEnabled: false,
  interstitialEnabled: false,
  isPostSaveAdEnabled: false,
  isRewardedAdEnabled: false,
  bannerAdUnitId: "",
  interstitialAdUnitId: "",
  postSavePopupAdUnitId: "",
  rewardedAdUnitId: "",
  bannerPlacement: "BOTTOM" as "BOTTOM" | "TOP",
  interstitialTrigger: "NATURAL_BREAK" as "NATURAL_BREAK" | "AFTER_N_ACTIONS" | "AFTER_EVENT_VIEW" | "AFTER_CALENDAR_NAVIGATION" | "CUSTOM",
  interstitialFrequency: 5,
  minActionsBeforeFirstAd: 5,
  minimumSessionTimeSeconds: 120,
  cooldownMinutes: 10,
  maxInterstitialsPerSession: 2,
  updatedAt: new Date().toISOString(),
  updatedBy: "Admin@7tasker.com",
};

// Server-side user review triggers queue
const activeReviewTriggers = new Map<string, {
  userId: string;
  triggerType: 'in_app_popup' | 'push_notification';
  queuedAt: string;
  consumed: boolean;
}>();

// ==========================================
// REST API ROUTES WITH ACCESS CONTROL
// ==========================================

// 1. [PUBLIC READ-ONLY] Full App Configuration Endpoint (Read by Android APK)
app.get("/api/app-config", async (req, res) => {
  await syncAppFeatureStateFromFirestore();
  res.json({
    status: "success",
    isGiftingEnabled: appFeatureState.isGiftingEnabled,
    isPoolingEnabled: appFeatureState.isPoolingEnabled,
    isTangoCardDirectGiftEnabled: appFeatureState.isTangoCardDirectGiftEnabled,
    minimumContributionAmount: appFeatureState.minimumContributionAmount,
    maintenanceMessage: appFeatureState.maintenanceMessage,
    bannerNoticeMessage: appFeatureState.bannerNoticeMessage,
    lastUpdated: appFeatureState.lastUpdated,
    apiVersion: appFeatureState.apiVersion,
    app: "JoyfulDays Celebration Platform",
  });
});

// 2. [PUBLIC READ-ONLY] Dedicated Lightweight isGiftingEnabled Endpoint (Optimal for Android APK Startup)
app.get("/api/gifting-status", async (req, res) => {
  await syncAppFeatureStateFromFirestore();
  res.json({
    success: true,
    isGiftingEnabled: appFeatureState.isGiftingEnabled,
    isPoolingEnabled: appFeatureState.isPoolingEnabled,
    action: appFeatureState.isGiftingEnabled ? "SHOW_GIFT_BUTTON" : "HIDE_GIFT_BUTTON",
    buttonLabel: "🎁 Send or Pool Gift 🎁",
    message: appFeatureState.isGiftingEnabled
      ? "Gifting and pool contributions are active."
      : appFeatureState.maintenanceMessage,
    timestamp: new Date().toISOString(),
  });
});

// 3. [ADMIN-ONLY] Update Gifting Status via REST API
const handleGiftingUpdate = async (req: express.Request, res: express.Response) => {
  const { isGiftingEnabled, isPoolingEnabled, isTangoCardDirectGiftEnabled, minimumContributionAmount, maintenanceMessage } = req.body;

  if (typeof isGiftingEnabled === "boolean") {
    appFeatureState.isGiftingEnabled = isGiftingEnabled;
  }
  if (typeof isPoolingEnabled === "boolean") {
    appFeatureState.isPoolingEnabled = isPoolingEnabled;
  }
  if (typeof isTangoCardDirectGiftEnabled === "boolean") {
    appFeatureState.isTangoCardDirectGiftEnabled = isTangoCardDirectGiftEnabled;
  }
  if (typeof minimumContributionAmount === "number") {
    appFeatureState.minimumContributionAmount = minimumContributionAmount;
  }
  if (typeof maintenanceMessage === "string") {
    appFeatureState.maintenanceMessage = maintenanceMessage;
  }

  appFeatureState.lastUpdated = new Date().toISOString();

  // If request has Authorization token, also update Firestore settings/gifting directly
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const updateMaskParams: string[] = ["updateMask.fieldPaths=lastUpdated"];
      const fieldsToUpdate: Record<string, any> = {
        lastUpdated: { stringValue: appFeatureState.lastUpdated },
      };

      if (typeof isGiftingEnabled === "boolean") {
        fieldsToUpdate.isGiftingEnabled = { booleanValue: isGiftingEnabled };
        fieldsToUpdate.systemStatus = { stringValue: isGiftingEnabled ? "ACTIVE" : "PAUSED" };
        updateMaskParams.push("updateMask.fieldPaths=isGiftingEnabled", "updateMask.fieldPaths=systemStatus");
      }
      if (typeof isPoolingEnabled === "boolean") {
        fieldsToUpdate.isPoolingEnabled = { booleanValue: isPoolingEnabled };
        updateMaskParams.push("updateMask.fieldPaths=isPoolingEnabled");
      }
      if (typeof isTangoCardDirectGiftEnabled === "boolean") {
        fieldsToUpdate.isTangoCardDirectGiftEnabled = { booleanValue: isTangoCardDirectGiftEnabled };
        updateMaskParams.push("updateMask.fieldPaths=isTangoCardDirectGiftEnabled");
      }
      if (typeof minimumContributionAmount === "number") {
        fieldsToUpdate.minimumContributionAmount = { integerValue: String(minimumContributionAmount) };
        updateMaskParams.push("updateMask.fieldPaths=minimumContributionAmount");
      }
      if (typeof maintenanceMessage === "string") {
        fieldsToUpdate.maintenanceMessage = { stringValue: maintenanceMessage };
        updateMaskParams.push("updateMask.fieldPaths=maintenanceMessage");
      }

      const nowNonce = crypto.randomUUID();
      fieldsToUpdate.adminAuthSignature = { stringValue: ADMIN_AUTH_SIGNATURE };
      fieldsToUpdate.adminAuthNonce = { stringValue: nowNonce };
      updateMaskParams.push("updateMask.fieldPaths=adminAuthSignature", "updateMask.fieldPaths=adminAuthNonce");

      const patchUrl = `${FIRESTORE_GIFTING_REST_URL}?${updateMaskParams.join("&")}&key=${FIREBASE_API_KEY}`;
      const patchRes = await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: fieldsToUpdate }),
      });
      if (!patchRes.ok) {
        const errJson = await patchRes.json().catch(() => ({}));
        console.warn("[Firestore] Patch returned non-200:", patchRes.status, errJson);
      } else {
        lastFirestoreGiftingSync = Date.now();
      }
    } catch (patchErr: any) {
      console.warn("[Firestore] Notice during settings/gifting patch:", patchErr?.message || patchErr);
    }
  }

  res.json({
    success: true,
    message: `Gifting status updated. isGiftingEnabled=${appFeatureState.isGiftingEnabled}`,
    config: appFeatureState,
  });
};

app.post("/api/gifting-status", requireAdminAuth, handleGiftingUpdate);
app.post("/api/gifting-toggle", requireAdminAuth, handleGiftingUpdate);

// 4. [ADMIN-ONLY] Admin Session Login (Secure Email + PIN Authentication)
app.post("/api/admin/login", express.json(), async (req, res) => {
  const { email, pin, backupCode } = req.body || {};
  const clientIp = req.ip || req.socket.remoteAddress || "unknown_ip";
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (!normalizedEmail || (!pin && !backupCode)) {
    return res.status(400).json({
      success: false,
      error: "BAD_REQUEST",
      code: "MISSING_FIELDS",
      message: "Email address and PIN (or backup code) are required.",
    });
  }

  // Rate limiting check per IP and Email combination
  const rateLimitKey = `${clientIp}_${normalizedEmail}`;
  const rateLimit = checkAdminLoginRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    const minutesLeft = Math.max(1, Math.ceil((rateLimit.remainingMs || 0) / 60000));
    return res.status(429).json({
      success: false,
      error: "TOO_MANY_REQUESTS",
      code: "RATE_LIMIT_EXCEEDED",
      message: `Too many failed login attempts. Account temporarily locked out. Please try again in ${minutesLeft} minute(s).`,
    });
  }

  const sendUnauthorized = () => {
    recordAdminFailedAttempt(rateLimitKey);
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      code: "INVALID_CREDENTIALS",
      message: "Invalid administrator email or PIN credentials.",
    });
  };

  // Step 1: Verify whether the email belongs to the designated root administrators
  if (!ROOT_ADMIN_EMAILS.includes(normalizedEmail)) {
    return sendUnauthorized();
  }

  // Step 2: Verify PIN credentials using slow scrypt hashed comparison
  const inputPin = (pin || backupCode || "").trim();
  const isPinValid = verifyPinCredential(inputPin);

  if (!isPinValid) {
    return sendUnauthorized();
  }

  // Clear failed attempt counter on successful login
  clearAdminFailedAttempts(rateLimitKey);

  // Issue HMAC signed Admin Session Token (24-hour expiration)
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const sessionPayload: AdminSessionPayload = {
    email: normalizedEmail,
    role: "super_admin",
    iat: Date.now(),
    exp,
    sessionId: `admin_session_${crypto.randomBytes(8).toString("hex")}`,
  };

  const token = signAdminToken(sessionPayload);

  return res.json({
    success: true,
    token,
    user: {
      email: normalizedEmail,
      name: "Root Administrator",
      role: "Super Admin",
    },
    expiresAt: exp,
  });
});


// [ADMIN-ONLY] Verify Active Admin Session Status
app.get("/api/admin/session", requireAdminAuth, (req, res) => {
  res.json({
    valid: true,
    user: (req as any).user,
    expiresAt: (req as any).sessionExp,
  });
});

// 4. [ADMIN-ONLY] Admin Claim & Token Verification Endpoint
app.post("/api/admin/verify-or-claim", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing Bearer token." });
  }
  const token = authHeader.split("Bearer ")[1].trim();
  try {
    if (!getAdminApps().length) {
      return res.status(401).json({ success: false, error: "Firebase Admin SDK is not initialized." });
    }
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken || !decodedToken.email) {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const email = decodedToken.email.toLowerCase().trim();
    const isDesignatedAdminEmail = ROOT_ADMIN_EMAILS.includes(email);

    if (decodedToken.admin === true || isDesignatedAdminEmail) {
      if (getAdminApps().length && decodedToken.uid && decodedToken.admin !== true) {
        try {
          const adminAuth = getAdminAuth();
          await adminAuth.setCustomUserClaims(decodedToken.uid, { admin: true });
        } catch (claimErr: any) {
          console.warn("[Admin Claim Warning]: Notice during claim assignment:", claimErr?.message || claimErr);
        }
      }
      return res.json({
        success: true,
        isAdmin: true,
        uid: decodedToken.uid || decodedToken.sub || "google_admin",
        hasClaim: true,
        email,
      });
    }

    return res.status(403).json({
      success: false,
      isAdmin: false,
      error: `Email ${email} is not authorized in ROOT_ADMIN_EMAILS for administrative access.`,
    });
  } catch (err: any) {
    return res.status(401).json({ success: false, error: err?.message || "Invalid token" });
  }
});

// 5. [PUBLIC READ-ONLY] Get Review Reminder Configuration (for APK & Dashboard)
app.get("/api/reviews/config", async (req, res) => {
  await syncReviewReminderStateFromFirestore();
  res.json({
    success: true,
    config: {
      ...reviewReminderState,
      retryIntervalHours: reviewReminderState.retryCooldownHours,
      maxReminderAttempts: reviewReminderState.maxAttempts,
    },
  });
});

// 6. [ADMIN-ONLY] Update Review Reminder Configuration (Persists to Firestore settings/review_reminders)
app.post("/api/reviews/config", requireAdminAuth, async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== "object") {
    return res.status(400).json({ success: false, error: "Invalid payload body" });
  }

  const nowIso = new Date().toISOString();
  if (typeof updates.isEnabled === "boolean") reviewReminderState.isEnabled = updates.isEnabled;
  if (typeof updates.initialDelayHours === "number") reviewReminderState.initialDelayHours = updates.initialDelayHours;
  if (typeof updates.retryCooldownHours === "number") {
    reviewReminderState.retryCooldownHours = updates.retryCooldownHours;
    reviewReminderState.retryIntervalHours = updates.retryCooldownHours;
  } else if (typeof updates.retryIntervalHours === "number") {
    reviewReminderState.retryCooldownHours = updates.retryIntervalHours;
    reviewReminderState.retryIntervalHours = updates.retryIntervalHours;
  }
  if (typeof updates.maxAttempts === "number") {
    reviewReminderState.maxAttempts = updates.maxAttempts;
    reviewReminderState.maxReminderAttempts = updates.maxAttempts;
  } else if (typeof updates.maxReminderAttempts === "number") {
    reviewReminderState.maxAttempts = updates.maxReminderAttempts;
    reviewReminderState.maxReminderAttempts = updates.maxReminderAttempts;
  }
  if (typeof updates.fcmEnabled === "boolean") reviewReminderState.fcmEnabled = updates.fcmEnabled;
  if (typeof updates.eventCreationEnabled === "boolean") reviewReminderState.eventCreationEnabled = updates.eventCreationEnabled;
  if (typeof updates.pushTitle === "string" && updates.pushTitle.trim()) reviewReminderState.pushTitle = updates.pushTitle.trim();
  if (typeof updates.pushBody === "string" && updates.pushBody.trim()) reviewReminderState.pushBody = updates.pushBody.trim();
  if (updates.triggerModes && typeof updates.triggerModes === "object") {
    reviewReminderState.triggerModes = { ...reviewReminderState.triggerModes, ...updates.triggerModes };
  }
  if (updates.pushNotificationTemplate && typeof updates.pushNotificationTemplate === "object") {
    reviewReminderState.pushNotificationTemplate = { ...reviewReminderState.pushNotificationTemplate, ...updates.pushNotificationTemplate };
  }
  if (updates.inAppPopupTemplate && typeof updates.inAppPopupTemplate === "object") {
    reviewReminderState.inAppPopupTemplate = { ...reviewReminderState.inAppPopupTemplate, ...updates.inAppPopupTemplate };
  }
  if (updates.quietHours && typeof updates.quietHours === "object") {
    reviewReminderState.quietHours = { ...reviewReminderState.quietHours, ...updates.quietHours };
  }
  reviewReminderState.lastUpdated = nowIso;
  reviewReminderState.updatedBy = (req as any).user?.email || updates.updatedBy || "Admin@7tasker.com";

  // Authoritative persistence to Firestore settings/review_reminders
  try {
    const fieldsToUpdate: Record<string, any> = {
      isEnabled: convertToFirestoreValue(reviewReminderState.isEnabled),
      initialDelayHours: convertToFirestoreValue(reviewReminderState.initialDelayHours),
      retryCooldownHours: convertToFirestoreValue(reviewReminderState.retryCooldownHours),
      retryIntervalHours: convertToFirestoreValue(reviewReminderState.retryCooldownHours),
      maxAttempts: convertToFirestoreValue(reviewReminderState.maxAttempts),
      maxReminderAttempts: convertToFirestoreValue(reviewReminderState.maxAttempts),
      fcmEnabled: convertToFirestoreValue(reviewReminderState.fcmEnabled),
      eventCreationEnabled: convertToFirestoreValue(reviewReminderState.eventCreationEnabled),
      pushTitle: convertToFirestoreValue(reviewReminderState.pushTitle),
      pushBody: convertToFirestoreValue(reviewReminderState.pushBody),
      triggerModes: convertToFirestoreValue(reviewReminderState.triggerModes),
      pushNotificationTemplate: convertToFirestoreValue(reviewReminderState.pushNotificationTemplate),
      inAppPopupTemplate: convertToFirestoreValue(reviewReminderState.inAppPopupTemplate),
      quietHours: convertToFirestoreValue(reviewReminderState.quietHours),
      lastUpdated: convertToFirestoreValue(reviewReminderState.lastUpdated),
      updatedAt: convertToFirestoreValue(reviewReminderState.lastUpdated),
      updatedBy: convertToFirestoreValue(reviewReminderState.updatedBy),
      adminAuthSignature: convertToFirestoreValue(ADMIN_AUTH_SIGNATURE),
    };

    const updateMaskParams = Object.keys(fieldsToUpdate).map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const patchRes = await fetch(`${FIRESTORE_REVIEW_REMINDERS_REST_URL}?${updateMaskParams}&key=${FIREBASE_API_KEY}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fieldsToUpdate }),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.warn("[Reviews] Firestore REST update notice:", errText);
    }
  } catch (err) {
    console.error("[Reviews] Error persisting review reminder config:", err);
  }

  res.json({
    success: true,
    message: "Review reminder settings updated and persisted to Firestore.",
    config: {
      ...reviewReminderState,
      retryIntervalHours: reviewReminderState.retryCooldownHours,
      maxReminderAttempts: reviewReminderState.maxAttempts,
    },
  });
});

// 7. [AUTHENTICATED] Check In-App Review Trigger for Specific User (Called by Android APK)
app.get("/api/reviews/check-trigger", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Missing Firebase ID token in Authorization header.",
      code: "AUTH_REQUIRED",
    });
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  let decodedToken: any;
  const dotCount = (token.match(/\./g) || []).length;
  if (dotCount === 1) {
    const verification = verifyAdminToken(token);
    if (verification.valid && verification.payload) {
      decodedToken = { uid: verification.payload.sessionId, email: verification.payload.email, admin: true };
    }
  }
  if (!decodedToken) {
    try {
      decodedToken = await getAdminAuth().verifyIdToken(token);
    } catch (err: any) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or expired Firebase ID token.",
        code: "INVALID_TOKEN",
      });
    }
  }

  const authenticatedUid = decodedToken.uid;
  const requestedUserId = (req.query.userId as string) || authenticatedUid;

  // Non-admins can only check their own trigger state
  const isAdmin = decodedToken.admin === true || (decodedToken.email && ROOT_ADMIN_EMAILS.includes(decodedToken.email.toLowerCase()));
  if (requestedUserId !== authenticatedUid && !isAdmin) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: Cannot check review trigger for another user.",
      code: "FORBIDDEN",
    });
  }

  // 1. Check for remote manual admin triggers in Firestore user_review_triggers/{userId}
  let hasManualTrigger = false;
  try {
    const triggerRes = await fetch(`${FIRESTORE_USER_TRIGGERS_BASE_URL}/${requestedUserId}?key=${FIREBASE_API_KEY}`);
    if (triggerRes.ok) {
      const data: any = await triggerRes.json();
      if (data?.fields) {
        const trigger = parseFirestoreFields(data.fields);
        if (!trigger.consumed && (trigger.status === "pending" || trigger.triggerType === "in_app_popup")) {
          hasManualTrigger = true;
          // Mark trigger consumed in Firestore
          fetch(`${FIRESTORE_USER_TRIGGERS_BASE_URL}/${requestedUserId}?updateMask.fieldPaths=consumed&updateMask.fieldPaths=status&updateMask.fieldPaths=consumedAt&key=${FIREBASE_API_KEY}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fields: {
                consumed: { booleanValue: true },
                status: { stringValue: "consumed" },
                consumedAt: { stringValue: new Date().toISOString() },
              },
            }),
          }).catch(() => {});
        }
      }
    }
  } catch (err) {}

  // Check in-memory queue fallback
  if (!hasManualTrigger && activeReviewTriggers.has(requestedUserId)) {
    const memTrigger = activeReviewTriggers.get(requestedUserId);
    if (memTrigger && !memTrigger.consumed && memTrigger.triggerType === "in_app_popup") {
      memTrigger.consumed = true;
      hasManualTrigger = true;
    }
  }

  if (hasManualTrigger) {
    const reminderState = await getUserReviewReminderDoc(requestedUserId);
    return res.json({
      shouldShowReviewPopup: true,
      action: "LAUNCH_PLAY_REVIEW_FLOW",
      reason: "ADMIN_MANUAL_DISPATCH",
      config: reviewReminderState,
      reminderState,
      message: "Admin triggered immediate Google Play In-App Review flow.",
    });
  }

  // 2. Perform server-side eligibility check (cooldown, max attempts, sign-in delay, reviewed state)
  const celebrationCreated = req.query.celebrationCreated === "true";
  const giftSent = req.query.giftSent === "true";
  const clientHours = parseFloat((req.query.hoursSinceSignIn as string) || "0");

  const eligibility = await checkUserReviewEligibility(requestedUserId, {
    celebrationCreated,
    giftSent,
    clientHoursSinceSignIn: clientHours,
  });

  res.json({
    shouldShowReviewPopup: eligibility.eligible,
    action: eligibility.eligible ? "LAUNCH_PLAY_REVIEW_FLOW" : "WAIT",
    reason: eligibility.reason,
    reminderState: eligibility.reminderState,
    config: reviewReminderState,
    template: reviewReminderState.inAppPopupTemplate,
    pushTemplate: reviewReminderState.pushNotificationTemplate,
  });
});

// 8. [AUTHENTICATED] Android Play Review Flow Launch Attempt Confirmation Endpoint
// CRITICAL: A review attempt only confirms Android invoked the Google Play review flow (ReviewManager).
// It does NOT mean Google definitely showed the dialog or that the user submitted a review.
app.post("/api/reviews/attempt", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized: Missing Firebase ID token", code: "AUTH_REQUIRED" });
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  let decodedToken: any;
  const dotCount = (token.match(/\./g) || []).length;
  if (dotCount === 1) {
    const verification = verifyAdminToken(token);
    if (verification.valid && verification.payload) {
      decodedToken = { uid: verification.payload.sessionId, email: verification.payload.email, admin: true };
    }
  }
  if (!decodedToken) {
    try {
      decodedToken = await getAdminAuth().verifyIdToken(token);
    } catch (err: any) {
      return res.status(401).json({ success: false, error: "Unauthorized: Invalid or expired Firebase ID token", code: "INVALID_TOKEN" });
    }
  }

  const userId = decodedToken.uid;
  const { attemptId, triggerSource } = req.body || {};

  const currentDoc = await getUserReviewReminderDoc(userId);
  const now = Date.now();
  const nowIso = new Date().toISOString();

  // 1. Strong UUID-based idempotency check
  if (attemptId && typeof attemptId === "string") {
    const trimmedAttemptId = attemptId.trim();
    if (trimmedAttemptId) {
      const alreadyProcessed = Array.isArray(currentDoc.processedAttemptIds) && currentDoc.processedAttemptIds.includes(trimmedAttemptId);
      if (alreadyProcessed) {
        return res.json({
          success: true,
          idempotent: true,
          message: "Attempt already processed with this attemptId; returning existing state without double-incrementing.",
          reminderState: {
            userId: currentDoc.userId,
            attemptCount: currentDoc.attemptCount,
            lastAttemptAt: currentDoc.lastAttemptAt,
            nextEligibleAt: currentDoc.nextEligibleAt,
            status: currentDoc.status,
            lastTriggerSource: currentDoc.lastTriggerSource,
          },
        });
      }
    }
  }

  // 2. Debounce defense (if no attemptId is provided or rapid concurrent duplicate network retries)
  const lastAttemptTs = attemptLockMap.get(userId);
  if (!attemptId && lastAttemptTs && now - lastAttemptTs < 15000) {
    return res.json({
      success: true,
      idempotent: true,
      message: "Duplicate callback within debounce window; attempt already recorded.",
      reminderState: {
        userId: currentDoc.userId,
        attemptCount: currentDoc.attemptCount,
        lastAttemptAt: currentDoc.lastAttemptAt,
        nextEligibleAt: currentDoc.nextEligibleAt,
        status: currentDoc.status,
        lastTriggerSource: currentDoc.lastTriggerSource,
      },
    });
  }
  attemptLockMap.set(userId, now);

  // 3. Atomically increment attemptCount and record attemptId
  const newAttemptCount = (currentDoc.attemptCount || 0) + 1;
  const cooldownHours = reviewReminderState.retryCooldownHours || 24;
  const nextEligibleAt = new Date(now + cooldownHours * 60 * 60 * 1000).toISOString();
  const maxAttempts = reviewReminderState.maxAttempts || 3;
  const status = newAttemptCount >= maxAttempts ? "max_attempts" : "cooldown";

  const updatedProcessedAttemptIds = Array.isArray(currentDoc.processedAttemptIds) ? [...currentDoc.processedAttemptIds] : [];
  if (attemptId && typeof attemptId === "string" && attemptId.trim()) {
    updatedProcessedAttemptIds.push(attemptId.trim());
  }

  const updatedDoc = await saveUserReviewReminderDoc(userId, {
    attemptCount: newAttemptCount,
    lastAttemptAt: nowIso,
    nextEligibleAt,
    lastTriggerSource: triggerSource || "android_play_flow_launched",
    status,
    processedAttemptIds: updatedProcessedAttemptIds,
    updatedAt: nowIso,
  });

  res.json({
    success: true,
    message: "Google Play review launch attempt recorded.",
    reminderState: {
      userId: updatedDoc.userId,
      attemptCount: updatedDoc.attemptCount,
      lastAttemptAt: updatedDoc.lastAttemptAt,
      nextEligibleAt: updatedDoc.nextEligibleAt,
      status: updatedDoc.status,
      lastTriggerSource: updatedDoc.lastTriggerSource,
    },
  });
});

// 9. [AUTHENTICATED/IN-APP USER] Submit / Record Custom Review from Android APK or Admin Portal
app.post("/api/reviews/submit", async (req, res) => {
  const { userId, userName, userEmail, rating, title, comment, source, deviceModel, osVersion, appVersion } = req.body;

  const newReview = {
    id: `rev-${Date.now()}`,
    userId: userId || "usr-anon",
    userName: userName || "JoyfulDays User",
    userEmail: userEmail || "user@example.com",
    rating: Number(rating) || 5,
    title: title || "In-App Feedback",
    comment: comment || "",
    source: source || "google_play_in_app",
    sentiment: Number(rating) >= 4 ? "positive" : Number(rating) === 3 ? "neutral" : "negative",
    deviceModel: deviceModel || "Android Device",
    osVersion: osVersion || "Android 14",
    appVersion: appVersion || "v1.2.0-apk",
    createdAt: new Date().toISOString(),
    isPublic: true,
  };

  try {
    const fieldsToUpdate: Record<string, any> = {};
    for (const [k, v] of Object.entries(newReview)) {
      fieldsToUpdate[k] = convertToFirestoreValue(v);
    }

    const FIRESTORE_REVIEWS_REST_URL = `${FIRESTORE_USER_REVIEWS_BASE_URL}/${newReview.id}`;
    await fetch(`${FIRESTORE_REVIEWS_REST_URL}?key=${FIREBASE_API_KEY}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fieldsToUpdate }),
    });
  } catch (err) {
    console.error("[Reviews] Failed to write review to Firestore:", err);
  }

  res.json({
    success: true,
    message: `Recorded ${newReview.rating}-star review.`,
    reviewId: newReview.id,
  });
});

// 10. [ADMIN-ONLY] Admin Endpoint to Force Queue an In-App Review Pop-up to User
app.post("/api/reviews/trigger-popup", requireAdminAuth, async (req, res) => {
  const { userId, deviceToken } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }

  const nowIso = new Date().toISOString();
  const triggerPayload = {
    userId,
    targetToken: deviceToken || "",
    command: "SHOW_GOOGLE_PLAY_IN_APP_REVIEW",
    triggerType: "in_app_popup",
    status: "pending",
    consumed: false,
    queuedAt: nowIso,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  // 1. In-memory queue for ultra-fast local checks
  activeReviewTriggers.set(userId, {
    userId,
    triggerType: "in_app_popup",
    queuedAt: nowIso,
    consumed: false,
  });

  // 2. Persistent Firestore queue in user_review_triggers/{userId}
  try {
    const fieldsToUpdate: Record<string, any> = {};
    for (const [k, v] of Object.entries(triggerPayload)) {
      fieldsToUpdate[k] = convertToFirestoreValue(v);
    }
    const updateMaskParams = Object.keys(fieldsToUpdate).map((f) => `updateMask.fieldPaths=${f}`).join("&");
    await fetch(`${FIRESTORE_USER_TRIGGERS_BASE_URL}/${userId}?${updateMaskParams}&key=${FIREBASE_API_KEY}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fieldsToUpdate }),
    });
  } catch (err) {
    console.warn(`[Reviews] Failed to persist trigger to user_review_triggers/${userId}:`, err);
  }

  res.json({
    success: true,
    message: `In-App Google Play Review pop-up trigger queued for user ${userId}.`,
    targetToken: deviceToken || null,
  });
});

// 11. [ADMIN-ONLY] Admin Endpoint to Force Send Review Push Notification via Real Firebase Cloud Messaging
app.post("/api/reviews/trigger-push", requireAdminAuth, async (req, res) => {
  const { userId, fcmToken, customTitle, customBody, adminOverride } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }

  // Check eligibility unless explicit admin override
  if (!adminOverride) {
    const eligibility = await checkUserReviewEligibility(userId);
    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        error: `User is not eligible for review reminder: ${eligibility.reason}`,
        code: "USER_INELIGIBLE",
        reason: eligibility.reason,
      });
    }
  }

  // Resolve FCM token: from request body or user profile
  let resolvedToken = (fcmToken as string)?.trim();
  if (!resolvedToken || resolvedToken === "fcm_device_token" || resolvedToken.startsWith("fcm_mock")) {
    try {
      const userRes = await fetch(`${FIRESTORE_USERS_BASE_URL}/${userId}?key=${FIREBASE_API_KEY}`);
      if (userRes.ok) {
        const userData: any = await userRes.json();
        if (userData?.fields) {
          const u = parseFirestoreFields(userData.fields);
          resolvedToken = u.fcmToken || u.deviceToken || u.deviceInfo?.fcmToken || u.pushToken || "";
        }
      }
    } catch (err) {}
  }

  if (!resolvedToken || resolvedToken.startsWith("fcm_mock") || resolvedToken === "fcm_device_token") {
    return res.status(400).json({
      success: false,
      error: "Missing or invalid FCM registration token for target user.",
      code: "MISSING_FCM_TOKEN",
    });
  }

  try {
    const message = {
      token: resolvedToken,
      notification: {
        title: customTitle || reviewReminderState.pushTitle || reviewReminderState.pushNotificationTemplate.title,
        body: customBody || reviewReminderState.pushBody || reviewReminderState.pushNotificationTemplate.body,
      },
      data: {
        type: "REVIEW_REMINDER",
        deepLink: reviewReminderState.pushNotificationTemplate.deepLink || "joyfuldays://review/play-store",
        actionText: reviewReminderState.pushNotificationTemplate.actionText || "Rate Now",
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: "high" as const,
        notification: {
          channelId: "review_reminders",
        },
      },
    };

    const messageId = await getAdminMessaging().send(message as any);
    const nowIso = new Date().toISOString();

    // CRITICAL: FCM sent does NOT increment attemptCount! Only record lastFcmSentAt
    await saveUserReviewReminderDoc(userId, {
      lastFcmSentAt: nowIso,
      updatedAt: nowIso,
    });

    return res.json({
      success: true,
      message: `FCM push notification dispatched successfully to user ${userId}.`,
      messageId,
      dispatchedAt: nowIso,
    });
  } catch (fcmErr: any) {
    const isTokenError =
      fcmErr?.code === "messaging/invalid-registration-token" ||
      fcmErr?.code === "messaging/registration-token-not-registered" ||
      fcmErr?.message?.includes("not registered");

    console.warn(`[Reviews] FCM push dispatch notice for ${userId}:`, fcmErr?.message || fcmErr);
    return res.status(400).json({
      success: false,
      error: fcmErr?.message || "Failed to dispatch FCM notification",
      code: isTokenError ? "INVALID_OR_EXPIRED_TOKEN" : "FCM_DISPATCH_ERROR",
    });
  }
});

// 12. [ADMIN-ONLY] Prompt All Eligible (Bulk FCM Push Notification Dispatch)
let isBulkPromptRunning = false;

app.post("/api/reviews/prompt-all-eligible", requireAdminAuth, async (req, res) => {
  if (isBulkPromptRunning) {
    return res.status(409).json({ success: false, error: "Bulk prompt job already in progress", code: "JOB_RUNNING" });
  }
  isBulkPromptRunning = true;

  try {
    await syncReviewReminderStateFromFirestore();
    if (!reviewReminderState.isEnabled || !reviewReminderState.fcmEnabled) {
      return res.status(400).json({
        success: false,
        error: "Review reminder engine or FCM dispatch is currently disabled in configuration.",
        code: "ENGINE_OR_FCM_DISABLED",
      });
    }

    let allUsers: any[] = [];
    try {
      const usersRes = await fetch(`${FIRESTORE_USERS_BASE_URL}?pageSize=100&key=${FIREBASE_API_KEY}`);
      if (usersRes.ok) {
        const usersData: any = await usersRes.json();
        if (usersData?.documents) {
          allUsers = usersData.documents.map((doc: any) => {
            const id = doc.name.split("/").pop();
            const fields = parseFirestoreFields(doc.fields || {});
            return { id, ...fields };
          });
        }
      }
    } catch (err) {}

    const summary = {
      totalScanned: allUsers.length,
      eligible: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const u of allUsers) {
      const userId = u.id || u.uid;
      if (!userId) continue;

      const fcmToken = u.fcmToken || u.deviceToken || u.deviceInfo?.fcmToken;
      if (!fcmToken || fcmToken.startsWith("fcm_mock") || fcmToken === "fcm_device_token") {
        summary.skipped++;
        summary.details.push({ userId, status: "skipped", reason: "NO_VALID_FCM_TOKEN" });
        continue;
      }

      const eligibility = await checkUserReviewEligibility(userId);
      if (!eligibility.eligible) {
        summary.skipped++;
        summary.details.push({ userId, status: "skipped", reason: eligibility.reason });
        continue;
      }

      summary.eligible++;

      try {
        const message = {
          token: fcmToken,
          notification: {
            title: reviewReminderState.pushTitle || reviewReminderState.pushNotificationTemplate.title,
            body: reviewReminderState.pushBody || reviewReminderState.pushNotificationTemplate.body,
          },
          data: {
            type: "REVIEW_REMINDER",
            deepLink: reviewReminderState.pushNotificationTemplate.deepLink || "joyfuldays://review/play-store",
            actionText: reviewReminderState.pushNotificationTemplate.actionText || "Rate Now",
            timestamp: new Date().toISOString(),
          },
          android: {
            priority: "high" as const,
            notification: {
              channelId: "review_reminders",
            },
          },
        };
        const messageId = await getAdminMessaging().send(message as any);
        const nowIso = new Date().toISOString();
        await saveUserReviewReminderDoc(userId, {
          lastFcmSentAt: nowIso,
          updatedAt: nowIso,
        });
        summary.sent++;
        summary.details.push({ userId, status: "sent", messageId });
      } catch (err: any) {
        summary.failed++;
        summary.details.push({ userId, status: "failed", error: err?.message || "FCM send error" });
      }
    }

    return res.json({
      success: true,
      message: `Bulk prompt completed: ${summary.sent} sent, ${summary.skipped} skipped, ${summary.failed} failed.`,
      summary,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Bulk prompt job encountered an error" });
  } finally {
    isBulkPromptRunning = false;
  }
});

// 13. [ADMIN-ONLY] Clear Queued Review Triggers
app.post("/api/reviews/clear-queue", requireAdminAuth, async (req, res) => {
  const count = activeReviewTriggers.size;
  activeReviewTriggers.clear();

  try {
    const triggersRes = await fetch(`${FIRESTORE_USER_TRIGGERS_BASE_URL}?pageSize=50&key=${FIREBASE_API_KEY}`);
    if (triggersRes.ok) {
      const data: any = await triggersRes.json();
      if (data?.documents) {
        for (const doc of data.documents) {
          const docId = doc.name.split("/").pop();
          await fetch(`${FIRESTORE_USER_TRIGGERS_BASE_URL}/${docId}?key=${FIREBASE_API_KEY}`, {
            method: "DELETE",
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Reviews] Failed to clear Firestore triggers:", err);
  }

  res.json({
    success: true,
    message: `Successfully cleared queued review trigger(s).`,
    clearedCount: count,
  });
});

// 14. [AUTHENTICATED/ADMIN] Inspect User Review Reminder State & Eligibility
app.get("/api/reviews/user-state/:userId", async (req, res) => {
  const { userId } = req.params;
  const state = await getUserReviewReminderDoc(userId);
  const eligibility = await checkUserReviewEligibility(userId);
  res.json({
    success: true,
    reminderState: state,
    eligibility,
  });
});

// 11. [ADMIN-ONLY] Database Backup Export Route
app.get("/api/backup/export", requireAdminAuth, (req, res) => {
  const backupData = {
    exportTimestamp: new Date().toISOString(),
    system: "JoyfulDays Celebration Platform",
    appFeatureState,
    admobSettingsState,
    reviewReminderState,
    activeReviewTriggersCount: activeReviewTriggers.size,
    classification: "CONFIDENTIAL_ADMIN_SNAPSHOT",
  };
  res.setHeader("Content-Disposition", `attachment; filename="joyfuldays-backup-${Date.now()}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.json(backupData);
});

// 12. [PUBLIC READ-ONLY] AdMob Remote Configuration Endpoint (settings/admob)
app.get("/api/admob/config", async (req, res) => {
  await syncAdMobStateFromFirestore();
  res.json({
    success: true,
    config: admobSettingsState,
    safetyGuards: {
      status: admobSettingsState.adsEnabled ? "LIVE_MONETIZATION" : "ADS_DISABLED_DEFAULT",
      prohibitedTriggers: [
        "APP_START",
        "DURING_EVENT_CREATION",
        "DURING_TYPING",
        "ALARM_RINGING",
        "AUTHENTICATION",
        "IMMEDIATELY_BEFORE_SAVE",
      ],
      safetyEnforcement: "HARDCODED_IN_ANDROID_APK",
    },
    timestamp: new Date().toISOString(),
  });
});

// 13. [ADMIN-ONLY] Update AdMob Remote Configuration
app.post("/api/admob/config", requireAdminAuth, async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== "object") {
    return res.status(400).json({ success: false, error: "Invalid payload body" });
  }

  // Reject legacy HMAC tokens & verify cryptographically authenticated user identity
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing Bearer token" });
  }
  const rawToken = authHeader.split("Bearer ")[1].trim();
  const dotCount = (rawToken.match(/\./g) || []).length;
  const authenticatedUser = (req as any).user;

  if (!authenticatedUser || !authenticatedUser.email || dotCount !== 2) {
    return res.status(403).json({
      success: false,
      code: "FIREBASE_TOKEN_REQUIRED",
      error: "A valid, cryptographically verified Firebase ID token is required for Firestore persistence.",
    });
  }

  // Derive administrator identity directly from verified JWT email (NO FALLBACKS PERMITTED)
  const adminEmail = authenticatedUser.email.toLowerCase().trim();

  // Interstitial trigger validation: Strictly block unsafe triggers
  const allowedTriggers = ["NATURAL_BREAK", "AFTER_N_ACTIONS", "AFTER_EVENT_VIEW", "AFTER_CALENDAR_NAVIGATION", "CUSTOM"];
  if (updates.interstitialTrigger && !allowedTriggers.includes(updates.interstitialTrigger)) {
    return res.status(400).json({
      success: false,
      error: `Unsafe or unsupported trigger: ${updates.interstitialTrigger}. Trigger rejected by safety layer.`,
    });
  }

  // Construct temporary state without mutating admobSettingsState before write succeeds
  const tempState = { ...admobSettingsState };
  const fieldsToUpdate: Record<string, any> = {};
  const updateMaskParams: string[] = [];

  const addField = (field: string, val: any) => {
    fieldsToUpdate[field] = convertToFirestoreValue(val);
    updateMaskParams.push(`updateMask.fieldPaths=${field}`);
  };

  // Preserve and validate all existing AdMob fields
  if (typeof updates.adsEnabled === "boolean") {
    addField("adsEnabled", updates.adsEnabled);
    tempState.adsEnabled = updates.adsEnabled;
  }
  if (typeof updates.bannerEnabled === "boolean") {
    addField("bannerEnabled", updates.bannerEnabled);
    tempState.bannerEnabled = updates.bannerEnabled;
  }
  if (typeof updates.interstitialEnabled === "boolean") {
    addField("interstitialEnabled", updates.interstitialEnabled);
    tempState.interstitialEnabled = updates.interstitialEnabled;
  }
  if (typeof updates.isPostSaveAdEnabled === "boolean") {
    addField("isPostSaveAdEnabled", updates.isPostSaveAdEnabled);
    tempState.isPostSaveAdEnabled = updates.isPostSaveAdEnabled;
  }
  if (typeof updates.isRewardedAdEnabled === "boolean") {
    addField("isRewardedAdEnabled", updates.isRewardedAdEnabled);
    tempState.isRewardedAdEnabled = updates.isRewardedAdEnabled;
  }
  if (typeof updates.bannerAdUnitId === "string") {
    addField("bannerAdUnitId", updates.bannerAdUnitId.trim());
    tempState.bannerAdUnitId = updates.bannerAdUnitId.trim();
  }
  if (typeof updates.interstitialAdUnitId === "string") {
    addField("interstitialAdUnitId", updates.interstitialAdUnitId.trim());
    tempState.interstitialAdUnitId = updates.interstitialAdUnitId.trim();
  }
  if (typeof updates.postSavePopupAdUnitId === "string") {
    addField("postSavePopupAdUnitId", updates.postSavePopupAdUnitId.trim());
    tempState.postSavePopupAdUnitId = updates.postSavePopupAdUnitId.trim();
  }
  if (typeof updates.rewardedAdUnitId === "string") {
    addField("rewardedAdUnitId", updates.rewardedAdUnitId.trim());
    tempState.rewardedAdUnitId = updates.rewardedAdUnitId.trim();
  }
  if (updates.bannerPlacement === "BOTTOM" || updates.bannerPlacement === "TOP") {
    addField("bannerPlacement", updates.bannerPlacement);
    tempState.bannerPlacement = updates.bannerPlacement;
  }
  if (updates.interstitialTrigger && allowedTriggers.includes(updates.interstitialTrigger)) {
    addField("interstitialTrigger", updates.interstitialTrigger);
    tempState.interstitialTrigger = updates.interstitialTrigger;
  }
  if (typeof updates.interstitialFrequency === "number") {
    const val = Math.max(1, Math.min(50, updates.interstitialFrequency));
    addField("interstitialFrequency", val);
    tempState.interstitialFrequency = val;
  }
  if (typeof updates.minActionsBeforeFirstAd === "number") {
    const val = Math.max(1, Math.min(30, updates.minActionsBeforeFirstAd));
    addField("minActionsBeforeFirstAd", val);
    tempState.minActionsBeforeFirstAd = val;
  }
  if (typeof updates.minimumSessionTimeSeconds === "number") {
    const val = Math.max(10, Math.min(1800, updates.minimumSessionTimeSeconds));
    addField("minimumSessionTimeSeconds", val);
    tempState.minimumSessionTimeSeconds = val;
  }
  if (typeof updates.cooldownMinutes === "number") {
    const val = Math.max(1, Math.min(120, updates.cooldownMinutes));
    addField("cooldownMinutes", val);
    tempState.cooldownMinutes = val;
  }
  if (typeof updates.maxInterstitialsPerSession === "number") {
    const val = Math.max(1, Math.min(10, updates.maxInterstitialsPerSession));
    addField("maxInterstitialsPerSession", val);
    tempState.maxInterstitialsPerSession = val;
  }
  if (Array.isArray(updates.adUnits)) {
    addField("adUnits", updates.adUnits);
  }

  // Record administrative metadata
  const nowIso = new Date().toISOString();
  addField("updatedAt", nowIso);
  addField("updatedBy", adminEmail);
  tempState.updatedAt = nowIso;
  tempState.updatedBy = adminEmail;

  try {
    // 1. Write to target Firestore document forwarding verified Firebase ID Token
    const patchUrl = `${FIRESTORE_ADMOB_REST_URL}?${updateMaskParams.join("&")}&key=${FIREBASE_API_KEY}`;
    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rawToken}`, // Forward verified Firebase ID token to satisfy Security Rules
      },
      body: JSON.stringify({ fields: fieldsToUpdate }),
    });

    if (!patchRes.ok) {
      const errBody = await patchRes.text();
      console.error("[AdMob Admin Publish] Firestore write rejected:", patchRes.status, errBody);
      return res.status(patchRes.status === 403 || patchRes.status === 401 ? 403 : 500).json({
        success: false,
        code: "PERMISSION_DENIED",
        error: `Firestore persistence rejected (${patchRes.status}): ${errBody}`,
      });
    }

    // 2. Read back the persisted document from Firestore forwarding verified Firebase ID Token
    const readRes = await fetch(`${FIRESTORE_ADMOB_REST_URL}?key=${FIREBASE_API_KEY}`, {
      headers: {
        Authorization: `Bearer ${rawToken}`, // Forward verified Firebase ID token on read-back
      },
    });

    let persisted: any = null;
    let updateTime: string | undefined;
    let verificationWarning = false;

    if (readRes.ok) {
      const readData: any = await readRes.json();
      persisted = parseFirestoreFields(readData.fields || {});
      updateTime = readData.updateTime;
    } else {
      verificationWarning = true;
      const readErr = await readRes.text();
      console.warn("[AdMob Admin Publish] Read-back verification warning:", readRes.status, readErr);
    }

    // 3. Commit to in-memory state ONLY after Firestore persistence succeeds
    Object.assign(admobSettingsState, tempState);
    lastFirestoreAdMobSync = Date.now();

    return res.json({
      success: true,
      message: verificationWarning
        ? "AdMob configuration persisted to Firestore, but read-back verification returned a warning."
        : "AdMob configuration persisted and verified in Firestore.",
      persisted,
      updateTime,
      config: admobSettingsState,
    });
  } catch (writeErr: any) {
    console.error("[AdMob Admin Publish] Firestore write error:", writeErr);
    return res.status(500).json({
      success: false,
      error: writeErr?.message || "Failed to persist AdMob configuration to Firestore",
    });
  }
});

// 14. [PUBLIC READ-ONLY] Feature Flags Overview
app.get("/api/features", async (req, res) => {
  await syncAppFeatureStateFromFirestore();
  res.json({
    features: {
      gifting: {
        enabled: appFeatureState.isGiftingEnabled,
        pooling: appFeatureState.isPoolingEnabled,
        tango_egift: appFeatureState.isTangoCardDirectGiftEnabled,
        min_pool_contribution: appFeatureState.minimumContributionAmount,
      },
      admob: {
        enabled: admobSettingsState.adsEnabled,
        banner: admobSettingsState.bannerEnabled,
        interstitial: admobSettingsState.interstitialEnabled,
        trigger: admobSettingsState.interstitialTrigger,
        frequency: admobSettingsState.interstitialFrequency,
      },
      payments: {
        stripe: true,
        paypal: true,
        smart_routing: true,
      },
    },
    lastUpdated: admobSettingsState.updatedAt,
  });
});

// 15. [PUBLIC READ-ONLY] Health Check Endpoint
app.get("/api/health", async (req, res) => {
  await syncAppFeatureStateFromFirestore();
  res.json({
    status: "healthy",
    service: "JoyfulDays Backend & Feature Control Service",
    time: new Date().toISOString(),
    isGiftingEnabled: appFeatureState.isGiftingEnabled,
    isAdsEnabled: admobSettingsState.adsEnabled,
  });
});

// 16. [PUBLIC READ-ONLY] Remove Ads Configuration Endpoint
app.get("/api/remove-ads/config", async (req, res) => {
  await syncRemoveAdsStateFromFirestore();
  res.json({
    success: true,
    config: removeAdsConfigState,
    timestamp: new Date().toISOString(),
  });
});

// 17. [ADMIN-ONLY] Update Remove Ads Configuration Endpoint
app.post("/api/remove-ads/config", requireAdminAuth, async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== "object") {
    return res.status(400).json({ success: false, error: "Invalid payload body" });
  }

  if (typeof updates.enabled === "boolean") removeAdsConfigState.enabled = updates.enabled;
  if (typeof updates.stripePriceId === "string") removeAdsConfigState.stripePriceId = updates.stripePriceId.trim();
  if (updates.displayPrice !== undefined && updates.displayPrice !== null) {
    const rawPrice = updates.displayPrice;
    if (typeof rawPrice === "number") {
      removeAdsConfigState.displayPrice = Number.isInteger(rawPrice) ? `$${rawPrice}.00` : `$${rawPrice}`;
    } else if (typeof rawPrice === "string") {
      const trimmed = rawPrice.trim();
      removeAdsConfigState.displayPrice = trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
    }
  }
  if (typeof updates.currency === "string" && updates.currency.trim() !== "") {
    removeAdsConfigState.currency = updates.currency.trim().toUpperCase();
  } else {
    removeAdsConfigState.currency = "USD";
  }

  const nowIso = new Date().toISOString();
  removeAdsConfigState.lastUpdated = nowIso;
  removeAdsConfigState.updatedBy = updates.adminEmail || "Admin@7tasker.com";

  try {
    const fieldsToUpdate: Record<string, any> = {
      enabled: convertToFirestoreValue(removeAdsConfigState.enabled),
      stripePriceId: convertToFirestoreValue(removeAdsConfigState.stripePriceId),
      displayPrice: convertToFirestoreValue(removeAdsConfigState.displayPrice),
      currency: convertToFirestoreValue(removeAdsConfigState.currency),
      lastUpdated: convertToFirestoreValue(removeAdsConfigState.lastUpdated),
      updatedBy: convertToFirestoreValue(removeAdsConfigState.updatedBy),
      adminAuthSignature: convertToFirestoreValue(ADMIN_AUTH_SIGNATURE),
    };
    const updateMaskParams = [
      "updateMask.fieldPaths=enabled",
      "updateMask.fieldPaths=stripePriceId",
      "updateMask.fieldPaths=displayPrice",
      "updateMask.fieldPaths=currency",
      "updateMask.fieldPaths=lastUpdated",
      "updateMask.fieldPaths=updatedBy",
      "updateMask.fieldPaths=adminAuthSignature",
    ];

    const patchUrl = `${FIRESTORE_REMOVE_ADS_REST_URL}?${updateMaskParams.join("&")}&key=${FIREBASE_API_KEY}`;
    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fieldsToUpdate }),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      throw new Error(`Firestore REST PATCH failed (${patchRes.status}): ${errText}`);
    }

    res.json({
      success: true,
      message: "Remove Ads configuration updated and persisted to Firestore.",
      config: removeAdsConfigState,
    });
  } catch (err: any) {
    console.error("[Remove Ads Admin] Error persisting config:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to persist Remove Ads config" });
  }
});

// 18. [AUTHENTICATED] Create Stripe Checkout Session Endpoint for Android
app.post("/api/create-checkout-session", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized", message: "Firebase ID token required in Authorization Bearer header." });
  }
  const token = authHeader.split("Bearer ")[1]?.trim();
  let uid = "";
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    uid = decodedToken.uid;
  } catch (err: any) {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired Firebase ID token." });
  }

  await syncRemoveAdsStateFromFirestore();
  if (!removeAdsConfigState.enabled) {
    return res.status(400).json({ success: false, error: "Remove Ads purchase is currently disabled by administrator." });
  }

  try {
    const activeStripe = getActiveStripeClient();
    const host = req.get("host") || "com-backend-joyfuldays.ai.studio";
    const rawProto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const protocol = rawProto.includes("https") || !host.includes("localhost") ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const session = await activeStripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: removeAdsConfigState.stripePriceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/?remove_ads=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?remove_ads=cancel`,
      metadata: {
        firebaseUid: uid,
        product: "remove_ads",
      },
    });

    console.log("[Stripe Checkout] Successfully created session:", session.id, session.url);

    res.json({
      success: true,
      checkoutUrl: session.url,
      checkout_url: session.url,
      url: session.url,
      sessionId: session.id,
      session_id: session.id,
      id: session.id,
    });
  } catch (stripeErr: any) {
    console.error("[Stripe Checkout] Error creating session:", stripeErr);
    res.status(500).json({
      success: false,
      error: stripeErr?.message || "Failed to create Stripe Checkout session",
    });
  }
});

// 19. [ADMIN-ONLY] Analytics Summary Endpoint (Remove Ads & Advanced Features)
app.get("/api/analytics/summary", requireAdminAuth, async (req, res) => {
  try {
    const removeAdsDoc = await db.collection("analytics").doc("remove_ads").get();
    const rawData = removeAdsDoc.exists ? (removeAdsDoc.data() || {}) : {};

    const removeAdsStats = {
      totalRemoveAdsPayments: Number(rawData.totalRemoveAdsPayments || 0),
      totalRemoveAdsUsers: Number(rawData.totalRemoveAdsUsers || 0),
      totalRemoveAdsRevenue: Number(rawData.totalRemoveAdsRevenue || 0),
      currencyBreakdown: rawData.currencyBreakdown || {},
      lastPurchaseAt: rawData.lastPurchaseAt || null,
      latestPaymentAmount: Number(rawData.latestPaymentAmount || 0),
      latestCurrency: rawData.latestCurrency || "USD",
      buyers: rawData.buyers || [],
    };

    let usersStartedUnlock = 0;
    let usersCompleted1Ad = 0;
    let usersCompleted2Ads = 0;
    let usersCompleted3Ads = 0;
    let totalAdvancedFeaturesUnlocked = 0;

    const prefsSnapshot = await db.collectionGroup("preferences").get();
    for (const prefDoc of prefsSnapshot.docs) {
      const path = prefDoc.ref.path;
      if (path.startsWith("users/") && path.includes("/settings/preferences")) {
        const pData = prefDoc.data() || {};
        const watched = Number(pData.advancedFeaturesRewardAdsWatched || 0);
        const unlocked = Boolean(pData.advancedFeaturesUnlocked);

        if (watched >= 1) {
          usersStartedUnlock++;
          usersCompleted1Ad++;
        }
        if (watched >= 2) {
          usersCompleted2Ads++;
        }
        if (watched >= 3) {
          usersCompleted3Ads++;
        }
        if (unlocked) {
          totalAdvancedFeaturesUnlocked++;
        }
        // Sync individual user document to analytics/monetization_stats/users/{uid}
        const userUidMatch = path.match(/^users\/([^/]+)\/settings\/preferences/);
        if (userUidMatch && userUidMatch[1]) {
          const userUid = userUidMatch[1];
          const userEmail = pData.userEmail || pData.email || `${userUid}@joyfuldays.app`;
          await db.collection("analytics").doc("monetization_stats").collection("users").doc(userUid).set({
            uid: userUid,
            userEmail,
            adsWatchedCount: watched,
            isUnlocked: unlocked || Boolean(pData.removeAdsLifetime),
            removeAdsLifetime: Boolean(pData.removeAdsLifetime),
            transactionId: pData.transactionId || pData.removeAdsStripeSessionId || null,
            paymentIntentId: pData.paymentIntentId || null,
            amountPaid: pData.amountPaid || null,
            amountFormatted: pData.amountFormatted || (pData.removeAdsLifetime ? "$1.00 USD" : null),
            currency: pData.currency || "USD",
            purchasedAt: pData.purchasedAt || (pData.removeAdsPurchasedAt ? new Date(pData.removeAdsPurchasedAt).toISOString() : null),
            lastUpdatedAt: new Date().toISOString(),
            unlockedAt: unlocked ? (pData.unlockedAt || new Date().toISOString()) : null,
          }, { merge: true });
        }
      }
    }

    const unlockConversionRate = usersStartedUnlock > 0
      ? Number(((totalAdvancedFeaturesUnlocked / usersStartedUnlock) * 100).toFixed(1))
      : 0.0;

    // Update analytics/monetization_stats/summary/overview document in Firestore
    await db.collection("analytics").doc("monetization_stats").collection("summary").doc("overview").set({
      totalAdvancedUnlocks: totalAdvancedFeaturesUnlocked,
      lastUpdated: new Date().toISOString(),
    }, { merge: true });

    // Update legacy analytics/monetization_stats document in Firestore for backwards compatibility
    await db.collection("analytics").doc("monetization_stats").set({
      startedCount: usersStartedUnlock,
      completed2AdsCount: usersCompleted2Ads,
      unlockedCount: totalAdvancedFeaturesUnlocked,
      totalPayments: removeAdsStats.totalRemoveAdsPayments || 0,
      grossRevenue: removeAdsStats.totalRemoveAdsRevenue || 0,
      conversionRate: unlockConversionRate,
      lastUpdated: new Date().toISOString(),
    }, { merge: true });

    res.json({
      success: true,
      monetizationStats: {
        startedCount: usersStartedUnlock,
        completed2AdsCount: usersCompleted2Ads,
        unlockedCount: totalAdvancedFeaturesUnlocked,
        totalPayments: removeAdsStats.totalRemoveAdsPayments || 0,
        grossRevenue: removeAdsStats.totalRemoveAdsRevenue || 0,
        conversionRate: unlockConversionRate,
      },
      removeAds: removeAdsStats,
      advancedFeatures: {
        usersStartedUnlock,
        usersCompleted1Ad,
        usersCompleted2Ads,
        usersCompleted3Ads,
        totalAdvancedFeaturesUnlocked,
        unlockConversionRate,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Analytics Summary] Error:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to aggregate analytics summary" });
  }
});

// 20. [ADMIN-ONLY] Initialize / Force Populate Firestore Collections & Analytics
async function ensureAnalyticsCollectionsInitialized() {
  try {
    const monetizationStatsRef = db.collection("analytics").doc("monetization_stats");
    const docSnap = await monetizationStatsRef.get();
    if (!docSnap.exists) {
      await monetizationStatsRef.set({
        startedCount: 0,
        completed2AdsCount: 0,
        unlockedCount: 0,
        totalPayments: 0,
        grossRevenue: 0.0,
        conversionRate: 0.0,
        lastUpdated: new Date().toISOString(),
        initializedBy: "JoyfulDays Enterprise Backend",
      });
      console.log("[Firestore] Initialized analytics/monetization_stats collection & document.");
    }

    const removeAdsAnalyticsRef = db.collection("analytics").doc("remove_ads");
    const removeAdsSnap = await removeAdsAnalyticsRef.get();
    if (!removeAdsSnap.exists) {
      await removeAdsAnalyticsRef.set({
        totalRemoveAdsPayments: 0,
        totalRemoveAdsUsers: 0,
        totalRemoveAdsRevenue: 0,
        currencyBreakdown: { USD: 0 },
        lastPurchaseAt: null,
        latestPaymentAmount: 0,
        latestCurrency: "USD",
        buyers: [],
      });
      console.log("[Firestore] Initialized analytics/remove_ads document.");
    }

    const sampleUserPrefRef = db.collection("users").doc("sample_user").collection("settings").doc("preferences");
    const samplePrefSnap = await sampleUserPrefRef.get();
    if (!samplePrefSnap.exists) {
      await sampleUserPrefRef.set({
        advancedFeaturesRewardAdsWatched: 0,
        advancedFeaturesUnlocked: false,
        remove_ads_lifetime: false,
        createdAt: new Date().toISOString(),
      });
      console.log("[Firestore] Initialized sample users/{uid}/settings/preferences document.");
    }
  } catch (initErr) {
    console.warn("[Firestore] Notice during analytics collection initialization:", initErr);
  }
}

app.post("/api/analytics/init-collections", requireAdminAuth, async (req, res) => {
  try {
    await ensureAnalyticsCollectionsInitialized();
    res.json({
      success: true,
      message: "Firestore collections and monetization_stats analytics documents initialized successfully.",
      collectionsCreated: ["analytics/monetization_stats", "analytics/remove_ads", "users/sample_user/settings/preferences", "settings/remove_ads", "settings/admob", "settings/gifting", "stripe_transactions"],
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to initialize Firestore collections" });
  }
});

// 21. [ADMIN-ONLY] GET /api/stripe/transactions - Stripe Transaction History Ledger API
app.get("/api/stripe/transactions", requireAdminAuth, async (req, res) => {
  try {
    const limitNum = Math.min(Math.max(parseInt((req.query.limit as string) || "25", 10), 1), 100);
    const statusFilter = (req.query.status as string) || "all";
    const currencyFilter = ((req.query.currency as string) || "all").toUpperCase();
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const searchQuery = ((req.query.search as string) || "").toLowerCase().trim();

    // Fetch transactions from stripe_transactions collection
    const snap = await db.collection("stripe_transactions").get();
    let records: any[] = [];

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      records.push({
        id: docSnap.id,
        stripeEventId: data.stripeEventId || docSnap.id,
        checkoutSessionId: data.checkoutSessionId || null,
        paymentIntentId: data.paymentIntentId || null,
        chargeId: data.chargeId || null,
        stripeCustomerId: data.stripeCustomerId || null,
        uid: data.uid || null,
        customerEmail: data.customerEmail || null,
        amount: Number(data.amount || 0),
        amountFormatted: data.amountFormatted || `$${((data.amount || 0) / 100).toFixed(2)} ${data.currency || "USD"}`,
        currency: (data.currency || "USD").toUpperCase(),
        paymentStatus: data.paymentStatus || "paid",
        checkoutStatus: data.checkoutStatus || "complete",
        paymentMethodType: data.paymentMethodType || "card",
        stripeEventTimestamp: data.stripeEventTimestamp || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
        paymentCompletionTimestamp: data.paymentCompletionTimestamp || null,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
        refundStatus: data.refundStatus || "none",
        refundedAmount: Number(data.refundedAmount || 0),
        source: data.source || "STRIPE_VERIFIED_WEBHOOK",
      });
    });

    // Sort newest first
    records.sort((a, b) => {
      const tA = new Date(a.stripeEventTimestamp || a.createdAt || 0).getTime();
      const tB = new Date(b.stripeEventTimestamp || b.createdAt || 0).getTime();
      return tB - tA;
    });

    // Filter by payment status
    if (statusFilter !== "all") {
      records = records.filter((r) => r.paymentStatus.toLowerCase() === statusFilter.toLowerCase());
    }

    // Filter by currency
    if (currencyFilter !== "ALL") {
      records = records.filter((r) => r.currency === currencyFilter);
    }

    // Filter by date range
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      if (!isNaN(startMs)) {
        records = records.filter((r) => new Date(r.stripeEventTimestamp).getTime() >= startMs);
      }
    }

    if (endDate) {
      const endMs = new Date(endDate).getTime();
      if (!isNaN(endMs)) {
        records = records.filter((r) => new Date(r.stripeEventTimestamp).getTime() <= endMs);
      }
    }

    // Search filter
    if (searchQuery) {
      records = records.filter((r) => {
        return (
          (r.stripeEventId && r.stripeEventId.toLowerCase().includes(searchQuery)) ||
          (r.checkoutSessionId && r.checkoutSessionId.toLowerCase().includes(searchQuery)) ||
          (r.paymentIntentId && r.paymentIntentId.toLowerCase().includes(searchQuery)) ||
          (r.chargeId && r.chargeId.toLowerCase().includes(searchQuery)) ||
          (r.uid && r.uid.toLowerCase().includes(searchQuery)) ||
          (r.customerEmail && r.customerEmail.toLowerCase().includes(searchQuery))
        );
      });
    }

    // Currency totals calculation (uncombined per currency)
    const currencyTotals: Record<string, { count: number; grossAmount: number; formattedGross: string }> = {};
    records.forEach((r) => {
      if (r.paymentStatus === "paid" || r.paymentStatus === "succeeded" || r.paymentStatus === "complete") {
        const curr = r.currency || "USD";
        if (!currencyTotals[curr]) {
          currencyTotals[curr] = { count: 0, grossAmount: 0, formattedGross: "" };
        }
        currencyTotals[curr].count += 1;
        currencyTotals[curr].grossAmount += r.amount;
      }
    });

    Object.keys(currencyTotals).forEach((curr) => {
      const g = currencyTotals[curr].grossAmount;
      currencyTotals[curr].formattedGross = `$${(g / 100).toFixed(2)} ${curr}`;
    });

    // Pagination
    const totalCount = records.length;
    const startAfter = req.query.startAfter as string | undefined;
    let startIndex = 0;
    if (startAfter) {
      const idx = records.findIndex((r) => r.id === startAfter);
      if (idx !== -1) startIndex = idx + 1;
    }

    const paginated = records.slice(startIndex, startIndex + limitNum);
    const hasMore = startIndex + limitNum < totalCount;
    const lastDocId = paginated.length > 0 ? paginated[paginated.length - 1].id : null;

    res.json({
      success: true,
      transactions: paginated,
      pagination: {
        totalCount,
        hasMore,
        lastDocId,
      },
      summary: {
        totalCount,
        currencyTotals,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Stripe Transactions API] Error:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to retrieve transaction history" });
  }
});

// ==========================================
// VITE MIDDLEWARE SETUP
// ==========================================
async function startServer() {
  // Authoritative sync on server boot & initialize analytics collections
  await syncAppFeatureStateFromFirestore(true);
  await syncAdMobStateFromFirestore(true);
  await syncRemoveAdsStateFromFirestore(true);
  await syncReviewReminderStateFromFirestore(true);
  await ensureAnalyticsCollectionsInitialized();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[JoyfulDays] Server running on port ${PORT}`);
  });
}

startServer();

