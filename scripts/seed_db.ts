import firebaseAppConfig from "../firebase-applet-config.json";

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || firebaseAppConfig.apiKey || "AIzaSyBA0Uk33AX8udd8tHwQQjTWeMU3v1poyiw";
const PROJECT_ID = firebaseAppConfig.projectId || "joyful-days";
const DATABASE_ID = firebaseAppConfig.firestoreDatabaseId || "ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1";

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

function convertToFirestoreFields(obj: Record<string, any>) {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      fields[k] = { nullValue: null };
    } else if (typeof v === "boolean") {
      fields[k] = { booleanValue: v };
    } else if (typeof v === "number") {
      fields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    } else if (typeof v === "string") {
      fields[k] = { stringValue: v };
    } else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map((item) => ({ stringValue: String(item) }))
        }
      };
    } else if (typeof v === "object") {
      const subFields: Record<string, any> = {};
      for (const [subK, subV] of Object.entries(v)) {
        subFields[subK] = typeof subV === "number" ? { integerValue: String(subV) } : { stringValue: String(subV) };
      }
      fields[k] = { mapValue: { fields: subFields } };
    }
  }
  return fields;
}

async function writeDoc(docPath: string, data: Record<string, any>) {
  const url = `${BASE_URL}/${docPath}?key=${FIREBASE_API_KEY}`;
  const fields = convertToFirestoreFields(data);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to write ${docPath}: ${res.status} - ${errText}`);
  }
  console.log(`Successfully wrote document: ${docPath}`);
}

async function seed() {
  console.log("Seeding Firestore collections via REST API...");

  // 1. analytics/monetization_stats
  await writeDoc("analytics/monetization_stats", {
    startedCount: 0,
    completed2AdsCount: 0,
    unlockedCount: 0,
    totalPayments: 0,
    grossRevenue: 0.0,
    conversionRate: 0.0,
    lastUpdated: new Date().toISOString(),
    initializedBy: "JoyfulDays REST Seeder",
  });

  // 2. analytics/remove_ads
  await writeDoc("analytics/remove_ads", {
    totalRemoveAdsPayments: 0,
    totalRemoveAdsUsers: 0,
    totalRemoveAdsRevenue: 0,
    lastPurchaseAt: new Date().toISOString(),
    latestPaymentAmount: 0,
    latestCurrency: "USD",
  });

  // 3. users/sample_user/settings/preferences
  await writeDoc("users/sample_user/settings/preferences", {
    advancedFeaturesRewardAdsWatched: 0,
    advancedFeaturesUnlocked: false,
    remove_ads_lifetime: false,
    createdAt: new Date().toISOString(),
  });

  // 4. settings/remove_ads
  await writeDoc("settings/remove_ads", {
    enabled: true,
    stripePriceId: "price_1UJWeQDJGa9mhIUX1Bb604Eq",
    displayPrice: "$2.99",
    currency: "USD",
    lastUpdated: new Date().toISOString(),
    updatedBy: "Admin@7tasker.com",
  });

  console.log("All Firestore collections and documents seeded successfully via REST API!");
}

seed().catch((err) => {
  console.error("REST seeding failed:", err);
  process.exit(1);
});
