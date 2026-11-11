import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

const STAGE_SCALE = Number(__ENV.STAGE_SCALE || 1);
const vu = (n) => Math.max(1, Math.round(n * STAGE_SCALE));

export const options = {
  stages: [
    { duration: '30s', target: vu(100) },
    { duration: '1m', target: vu(500) },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  // Browse products
  const productsRes = http.get(`${BASE_URL}/api/v1/products?page=0&size=20`);
  check(productsRes, {
    'products status 200': (r) => r.status === 200,
    'products has content': (r) => {
      try {
        return JSON.parse(r.body).data.content.length > 0;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(productsRes.status !== 200);
  responseTime.add(productsRes.timings.duration);

  sleep(1);

  // Search products (matches seeded laptops in V3__seed_data.sql)
  const searchRes = http.get(`${BASE_URL}/api/v1/products/search?q=laptop`);
  check(searchRes, {
    'search status 200': (r) => r.status === 200,
    'search has content': (r) => {
      try {
        return JSON.parse(r.body).data.content.length > 0;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(searchRes.status !== 200);
  responseTime.add(searchRes.timings.duration);

  sleep(0.5);
}
