import test from 'node:test';
import assert from 'node:assert/strict';
import { dnsTransition, generateWatchDomains, normalizeDomain } from './domain-watch-utils.js';

test('normalizes URL-shaped domains', () => {
  assert.equal(normalizeDomain('https://www.AgenticBro.app/path'), 'agenticbro.app');
});

test('generates unique bounded lookalike domains', () => {
  const variants = generateWatchDomains('agenticbro.app', 25);
  assert.equal(variants.length, 25);
  assert.equal(new Set(variants).size, variants.length);
  assert.ok(variants.includes('agenticbro.com'));
  assert.ok(!variants.includes('agenticbro.app'));
});

test('detects activation and MX transitions', () => {
  assert.equal(dnsTransition({ resolves: false, mx_records: [] }, { resolves: true, mx_records: [] }), 'activated');
  assert.equal(dnsTransition({ resolves: true, mx_records: [] }, { resolves: true, mx_records: ['mx.example'] }), 'mx_added');
  assert.equal(dnsTransition({ resolves: true, mx_records: ['mx.example'] }, { resolves: true, mx_records: ['mx.example'] }), null);
});
