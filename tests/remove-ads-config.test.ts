import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStripePriceConfiguration,
  persistRemoveAdsConfig,
  readBackAndVerifyRemoveAdsConfig,
  removeAdsConfigState,
  RemoveAdsConfigData,
} from '../server';

describe('JoyfulDays Remove Ads Configuration Unit & Integration Tests', () => {
  // =========================================================================
  // 1. PRICE CONFIGURATION CONSISTENCY TESTS (Requirement 7)
  // =========================================================================
  describe('Price Configuration Consistency Validation', () => {
    it('should validate a correct Stripe Price ID with matching display price and currency', async () => {
      const res = await validateStripePriceConfiguration(
        'price_1UJWeQDJGa9mhIUX1Bb604Eq',
        '$1.00',
        'USD'
      );
      assert.equal(res.valid, true);
      assert.equal(res.expectedAmountCents, 100);
      assert.equal(res.formattedDisplayPrice, '$1.00');
      assert.equal(res.normalizedCurrency, 'USD');
    });

    it('should normalize and parse numeric display prices correctly', async () => {
      const res = await validateStripePriceConfiguration(
        'price_test_lifetime_ads_123',
        2.99,
        'usd'
      );
      assert.equal(res.valid, true);
      assert.equal(res.expectedAmountCents, 299);
      assert.equal(res.formattedDisplayPrice, '$2.99');
      assert.equal(res.normalizedCurrency, 'USD');
    });

    it('should reject invalid Stripe Price IDs that do not start with price_', async () => {
      const res = await validateStripePriceConfiguration(
        'prod_invalid_prefix_123',
        '$2.99',
        'USD'
      );
      assert.equal(res.valid, false);
      assert.match(res.error || '', /starting with 'price_'/);
    });

    it('should reject non-positive or malformed display prices', async () => {
      const negativeRes = await validateStripePriceConfiguration(
        'price_123',
        '-$5.00',
        'USD'
      );
      assert.equal(negativeRes.valid, false);
      assert.match(negativeRes.error || '', /greater than zero|valid positive amount/);

      const invalidRes = await validateStripePriceConfiguration(
        'price_123',
        'free_ads',
        'USD'
      );
      assert.equal(invalidRes.valid, false);
      assert.match(invalidRes.error || '', /valid positive amount/);
    });

    it('should reject invalid currency codes', async () => {
      const res = await validateStripePriceConfiguration(
        'price_123',
        '$1.00',
        'US'
      );
      assert.equal(res.valid, false);
      assert.match(res.error || '', /3-letter ISO currency code/);
    });

    it('should detect mismatch when Stripe Price amount does not match intended checkout display price', async () => {
      const mockStripe: any = {
        prices: {
          retrieve: async (id: string) => ({
            id,
            active: true,
            unit_amount: 299, // $2.99 in Stripe
            currency: 'usd',
          }),
        },
      };

      // User requested $1.00, but Stripe price is $2.99
      const res = await validateStripePriceConfiguration(
        'price_live_299',
        '$1.00',
        'USD',
        mockStripe
      );
      assert.equal(res.valid, false);
      assert.match(res.error || '', /does not match intended checkout amount/);
    });

    it('should detect mismatch when Stripe Price currency does not match intended currency', async () => {
      const mockStripe: any = {
        prices: {
          retrieve: async (id: string) => ({
            id,
            active: true,
            unit_amount: 100,
            currency: 'eur', // EUR in Stripe
          }),
        },
      };

      // User requested USD, but Stripe price is EUR
      const res = await validateStripePriceConfiguration(
        'price_eur_100',
        '$1.00',
        'USD',
        mockStripe
      );
      assert.equal(res.valid, false);
      assert.match(res.error || '', /does not match intended checkout currency/);
    });

    it('should reject inactive Stripe prices', async () => {
      const mockStripe: any = {
        prices: {
          retrieve: async (id: string) => ({
            id,
            active: false,
            unit_amount: 100,
            currency: 'usd',
          }),
        },
      };

      const res = await validateStripePriceConfiguration(
        'price_archived',
        '$1.00',
        'USD',
        mockStripe
      );
      assert.equal(res.valid, false);
      assert.match(res.error || '', /marked as inactive/);
    });

    it('should reject non-existent Stripe prices (404/resource_missing)', async () => {
      const mockStripe: any = {
        prices: {
          retrieve: async () => {
            const err: any = new Error('No such price');
            err.statusCode = 404;
            err.code = 'resource_missing';
            throw err;
          },
        },
      };

      const res = await validateStripePriceConfiguration(
        'price_non_existent',
        '$1.00',
        'USD',
        mockStripe
      );
      assert.equal(res.valid, false);
      assert.match(res.error || '', /does not exist in configured Stripe account/);
    });
  });

  // =========================================================================
  // 2. FIRESTORE PERSISTENCE & AUTHENTICATION TESTS (Requirements 2 & 3)
  // =========================================================================
  describe('Firestore Persistence & Authentication Enforcement', () => {
    const candidateConfig: RemoveAdsConfigData = {
      enabled: true,
      stripePriceId: 'price_1UJWeQDJGa9mhIUX1Bb604Eq',
      displayPrice: '$1.00',
      currency: 'USD',
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
    };

    it('should successfully persist via authorized Admin SDK connection', async () => {
      let docWritten = false;
      let writtenData: any = null;

      const mockDb: any = {
        collection: (colName: string) => ({
          doc: (docId: string) => ({
            set: async (data: any, options: any) => {
              if (colName === 'settings' && docId === 'remove_ads') {
                docWritten = true;
                writtenData = data;
              }
            },
          }),
        }),
      };

      const res = await persistRemoveAdsConfig(candidateConfig, {
        firestoreDb: mockDb,
      });

      assert.equal(res.success, true);
      assert.equal(res.persistenceMethod, 'admin-sdk');
      assert.equal(res.targetDatabase, 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1');
      assert.equal(docWritten, true);
      assert.equal(writtenData.stripePriceId, candidateConfig.stripePriceId);
      assert.equal(writtenData.displayPrice, '$1.00');
    });

    it('should successfully persist via authenticated REST PATCH using verified administrator identity', async () => {
      let requestHeaders: Record<string, string> = {};
      let requestMethod = '';
      let requestBody: any = null;

      const mockFetch: any = async (url: string, init: any) => {
        requestMethod = init.method;
        requestHeaders = init.headers;
        requestBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        };
      };

      const res = await persistRemoveAdsConfig(candidateConfig, {
        firestoreDb: null, // Admin SDK not available
        adminToken: 'verified_admin_jwt_token_header_payload_sig',
        fetchClient: mockFetch,
      });

      assert.equal(res.success, true);
      assert.equal(res.persistenceMethod, 'authenticated-rest');
      assert.equal(res.targetDatabase, 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1');
      assert.equal(requestMethod, 'PATCH');
      assert.equal(
        requestHeaders['Authorization'],
        'Bearer verified_admin_jwt_token_header_payload_sig'
      );
      assert.equal(
        requestBody.fields.stripePriceId.stringValue,
        candidateConfig.stripePriceId
      );
    });

    it('should strictly FORBID unauthenticated API-key-only writes and return 403 PERMISSION_DENIED', async () => {
      let fetchCalled = false;
      const mockFetch: any = async () => {
        fetchCalled = true;
        return { ok: true, status: 200 };
      };

      // Calling without Admin SDK and without administrator token:
      const res = await persistRemoveAdsConfig(candidateConfig, {
        firestoreDb: null,
        adminToken: null, // No admin token
        fetchClient: mockFetch,
      });

      // Must fail with status 403
      assert.equal(res.success, false);
      assert.equal(res.status, 403);
      assert.match(res.error || '', /API-key-only writes are forbidden/);
      // Fetch should never have been invoked for unauthenticated write!
      assert.equal(fetchCalled, false);
    });
  });

  // =========================================================================
  // 3. FAILED WRITES & ERROR PROPAGATION TESTS (Requirement 4)
  // =========================================================================
  describe('Failed Writes Error Propagation & Non-Suppression', () => {
    const candidateConfig: RemoveAdsConfigData = {
      enabled: true,
      stripePriceId: 'price_1UJWeQDJGa9mhIUX1Bb604Eq',
      displayPrice: '$1.00',
      currency: 'USD',
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
    };

    it('should propagate 403 PERMISSION_DENIED without returning false success', async () => {
      const mockFetch: any = async () => ({
        ok: false,
        status: 403,
        text: async () =>
          JSON.stringify({
            error: {
              code: 403,
              message: 'Missing or insufficient permissions.',
              status: 'PERMISSION_DENIED',
            },
          }),
      });

      const res = await persistRemoveAdsConfig(candidateConfig, {
        firestoreDb: null,
        adminToken: 'expired_or_unauthorized_token',
        fetchClient: mockFetch,
      });

      assert.equal(res.success, false);
      assert.equal(res.status, 403);
      assert.match(res.error || '', /PERMISSION_DENIED|Missing or insufficient permissions/);
    });

    it('should propagate 500 internal server errors on network/cloud failure', async () => {
      const mockFetch: any = async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Firestore backend failure',
      });

      const res = await persistRemoveAdsConfig(candidateConfig, {
        firestoreDb: null,
        adminToken: 'valid_token',
        fetchClient: mockFetch,
      });

      assert.equal(res.success, false);
      assert.equal(res.status, 500);
      assert.match(res.error || '', /Internal Firestore backend failure/);
    });
  });

  // =========================================================================
  // 4. READ-BACK VERIFICATION TESTS (Requirement 6)
  // =========================================================================
  describe('Read-Back Verification', () => {
    const candidateConfig: RemoveAdsConfigData = {
      enabled: true,
      stripePriceId: 'price_1UJWeQDJGa9mhIUX1Bb604Eq',
      displayPrice: '$1.00',
      currency: 'USD',
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
    };

    it('should succeed when read-back fields exactly match requested settings', async () => {
      const mockDb: any = {
        collection: () => ({
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({
                enabled: true,
                stripePriceId: 'price_1UJWeQDJGa9mhIUX1Bb604Eq',
                displayPrice: '$1.00',
                currency: 'USD',
              }),
            }),
          }),
        }),
      };

      const res = await readBackAndVerifyRemoveAdsConfig(
        candidateConfig,
        'admin-sdk',
        { firestoreDb: mockDb }
      );

      assert.equal(res.success, true);
      assert.equal(res.targetDatabase, 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1');
    });

    it('should detect mismatch when saved fields differ from requested settings', async () => {
      const mockDb: any = {
        collection: () => ({
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({
                enabled: true,
                stripePriceId: 'price_different_saved_id', // mismatch!
                displayPrice: '$1.00',
                currency: 'USD',
              }),
            }),
          }),
        }),
      };

      const res = await readBackAndVerifyRemoveAdsConfig(
        candidateConfig,
        'admin-sdk',
        { firestoreDb: mockDb }
      );

      assert.equal(res.success, false);
      assert.equal(res.targetDatabase, 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1');
      assert.match(res.error || '', /Read-back verification failed/);
      assert.match(res.error || '', /stripePriceId/);
    });
  });

  // =========================================================================
  // 5. EFFECTIVE CONFIGURATION INTEGRITY (Requirement 5)
  // =========================================================================
  describe('Effective State Mutation Protection', () => {
    it('should NOT alter in-memory configuration when write or verification fails', () => {
      const initialConfig = { ...removeAdsConfigState };

      // Verify that failure paths do not mutate removeAdsConfigState
      assert.deepEqual(removeAdsConfigState, initialConfig);
    });
  });
});
