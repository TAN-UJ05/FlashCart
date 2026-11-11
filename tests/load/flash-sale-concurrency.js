import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const successfulReservations = new Counter('successful_reservations');
const failedReservations = new Counter('failed_reservations');
const rateLimited = new Counter('rate_limited');
const errorRate = new Rate('error_rate');

const STAGE_SCALE = Number(__ENV.STAGE_SCALE || 1);
const START_RATE = Math.max(1, Math.round(100 * STAGE_SCALE));
const PEAK_RATE = Math.max(1, Math.round(Number(__ENV.TARGET_RATE || 10000) * STAGE_SCALE));

export const options = {
  // 10,000 concurrent flash-sale purchase attempts against 100-unit stock (scalable via STAGE_SCALE)
  scenarios: {
    flash_sale_rush: {
      executor: 'ramping-arrival-rate',
      startRate: START_RATE,
      timeUnit: '1s',
      preAllocatedVUs: Math.max(10, Math.round(500 * STAGE_SCALE)),
      maxVUs: Math.max(20, Math.round(1000 * STAGE_SCALE)),
      stages: [
        { target: PEAK_RATE, duration: '10s' },
        { target: 0, duration: '5s' },
      ],
    },
  },
  thresholds: {
    successful_reservations: ['count<=100'], // MUST NOT exceed sale_stock
    error_rate: ['rate<0.05'], // Only unexpected 5xx / 4xx failures (409 sold-out and 429 rate-limited are tracked separately)
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || 'customer1@flashcart.com';
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD || 'Customer@123';

export function setup() {
  let flashSaleId = __ENV.FLASH_SALE_ID || '';
  let productId = __ENV.PRODUCT_ID || '';
  let token = __ENV.TEST_USER_TOKEN || '';

  if (!flashSaleId || !productId) {
    const liveRes = http.get(`${BASE_URL}/api/v1/flash-sales/live`);
    if (liveRes.status !== 200) {
      throw new Error(`Failed to fetch live flash sales in setup(): HTTP ${liveRes.status}`);
    }
    const sales = liveRes.json()?.data || [];
    if (!sales.length) {
      throw new Error('No live flash sale found via GET /api/v1/flash-sales/live');
    }
    const sale = flashSaleId ? (sales.find((s) => s.id === flashSaleId) || sales[0]) : sales[0];
    flashSaleId = flashSaleId || sale.id;
    const items = sale.items || [];
    if (!items.length) {
      throw new Error(`Flash sale ${flashSaleId} has no items`);
    }
    const targetItem = items.find((it) => it.saleStock === 100) || items[0];
    productId = productId || targetItem.productId;
  }

  if (!token) {
    const loginRes = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (loginRes.status !== 200) {
      throw new Error(`Setup login failed for ${TEST_USER_EMAIL}: HTTP ${loginRes.status}`);
    }
    token = loginRes.json()?.data?.accessToken || '';
  }

  if (!flashSaleId || !productId || !token) {
    throw new Error('Missing flashSaleId, productId, or access token after setup()');
  }

  return { flashSaleId, productId, token };
}

export default function (data) {
  const idempotencyKey = `test-${__VU}-${__ITER}`;

  const res = http.post(
    `${BASE_URL}/api/v1/flash-sales/${data.flashSaleId}/purchase`,
    JSON.stringify({
      productId: data.productId,
      quantity: 1,
      idempotencyKey,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
        'Idempotency-Key': idempotencyKey,
      },
    }
  );

  if (res.status === 200 || res.status === 201) {
    successfulReservations.add(1);
    errorRate.add(false);
    check(res, { 'reservation successful': (r) => r.status === 200 || r.status === 201 });
  } else if (res.status === 409) {
    failedReservations.add(1); // Sold out / conflict — expected under high concurrency
    errorRate.add(false);
  } else if (res.status === 429) {
    rateLimited.add(1); // Bucket4j flash-sale rate limit — tracked separately from errors
    errorRate.add(false);
  } else {
    errorRate.add(true); // Unexpected 5xx or unexpected 4xx
  }
}

export function handleSummary(data) {
  const successful = data.metrics.successful_reservations?.values?.count || 0;
  const failed = data.metrics.failed_reservations?.values?.count || 0;
  const limited = data.metrics.rate_limited?.values?.count || 0;
  const unexpectedRate = data.metrics.error_rate?.values?.rate || 0;
  const totalRequests = data.metrics.http_reqs?.values?.count || (successful + failed + limited);

  const summaryText = [
    '',
    '=== FLASH SALE CONCURRENCY TEST RESULTS ===',
    `Total HTTP requests:         ${totalRequests}`,
    `Successful reservations:     ${successful} (must be <= 100)`,
    `Sold-out rejections (409):   ${failed}`,
    `Rate-limited (429):          ${limited}`,
    `Unexpected error rate:       ${(unexpectedRate * 100).toFixed(2)}%`,
    `Overselling:                 ${successful > 100 ? 'YES - CRITICAL BUG!' : 'NO - PASS'}`,
    '',
  ].join('\n');

  const outputs = {
    stdout: summaryText,
  };

  if (__ENV.SUMMARY_PATH) {
    outputs[__ENV.SUMMARY_PATH] = JSON.stringify(data, null, 2);
  }

  return outputs;
}
