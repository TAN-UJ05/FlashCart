import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const checkoutErrors = new Rate('checkout_errors');
const cartDuration = new Trend('cart_duration');

const STAGE_SCALE = Number(__ENV.STAGE_SCALE || 1);
const vu = (n) => Math.max(1, Math.round(n * STAGE_SCALE));

export const options = {
  stages: [
    { duration: '30s', target: vu(50) },
    { duration: '2m', target: vu(200) },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    checkout_errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || 'customer1@flashcart.com';
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD || 'Customer@123';

export function setup() {
  if (__ENV.TEST_USER_TOKEN) {
    return { token: __ENV.TEST_USER_TOKEN };
  }

  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(loginRes, { 'login status 200': (r) => r.status === 200 });
  const token = loginRes.json()?.data?.accessToken;
  if (!token) {
    throw new Error(`Setup login failed for ${TEST_USER_EMAIL}: HTTP ${loginRes.status}`);
  }
  return { token };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Get cart
  const cartRes = http.get(`${BASE_URL}/api/v1/cart`, { headers });
  check(cartRes, { 'cart status 200': (r) => r.status === 200 });
  checkoutErrors.add(cartRes.status !== 200);
  cartDuration.add(cartRes.timings.duration);

  sleep(0.5);

  // List user orders
  const ordersRes = http.get(`${BASE_URL}/api/v1/orders?page=0&size=10`, { headers });
  check(ordersRes, { 'orders status 200': (r) => r.status === 200 });
  checkoutErrors.add(ordersRes.status !== 200);

  sleep(1);
}
