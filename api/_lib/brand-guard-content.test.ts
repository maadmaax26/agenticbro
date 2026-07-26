import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBrandGuardContentCandidate,
  type CompletedBrandGuardScan,
} from './brand-guard-content.ts';

function scan(overrides: Partial<CompletedBrandGuardScan> = {}): CompletedBrandGuardScan {
  return {
    id: 'scan-row-1',
    owner_id: 'owner-1',
    brand_name: 'Example Company',
    status: 'complete',
    completed_at: '2026-07-26T12:00:00.000Z',
    content_reuse_consent: true,
    content_reuse_scope: 'anonymized',
    content_reuse_revoked_at: null,
    result: {
      real_scan: true,
      real_scan_pending: false,
      impersonators: [
        {
          username: 'example_support',
          profile_url: 'https://example.invalid/private',
          bio: 'raw profile data',
          platform: 'x',
          risk_level: 'HIGH',
        },
        {
          username: 'example_help',
          platform: 'instagram',
          risk_level: 'CRITICAL',
        },
      ],
    },
    ...overrides,
  };
}

test('blocks previews, revoked consent, and scans without an owner', () => {
  assert.equal(buildBrandGuardContentCandidate(scan({ result: { real_scan_pending: true } })), null);
  assert.equal(buildBrandGuardContentCandidate(scan({ content_reuse_revoked_at: '2026-07-26T13:00:00Z' })), null);
  assert.equal(buildBrandGuardContentCandidate(scan({ owner_id: null })), null);
});

test('blocks scans without high-confidence findings', () => {
  assert.equal(buildBrandGuardContentCandidate(scan({
    result: {
      real_scan: true,
      real_scan_pending: false,
      impersonators: [{ username: 'example', platform: 'x', risk_level: 'MEDIUM' }],
    },
  })), null);
});

test('anonymizes brand and raw finding identifiers', () => {
  const candidate = buildBrandGuardContentCandidate(scan());
  assert.ok(candidate);
  const serialized = JSON.stringify(candidate);
  assert.equal(candidate.content_scope, 'anonymized');
  assert.equal(candidate.safe_summary.total_findings, 2);
  assert.equal(candidate.safe_summary.critical_count, 1);
  assert.deepEqual(candidate.safe_summary.platforms, ['instagram', 'x']);
  assert.ok(!serialized.includes('Example Company'));
  assert.ok(!serialized.includes('example_support'));
  assert.ok(!serialized.includes('example.invalid'));
  assert.ok(!serialized.includes('raw profile data'));
});

test('includes only the brand name when named consent is recorded', () => {
  const candidate = buildBrandGuardContentCandidate(scan({ content_reuse_scope: 'named' }));
  assert.ok(candidate);
  const serialized = JSON.stringify(candidate);
  assert.equal(candidate.safe_summary.brand_name, 'Example Company');
  assert.ok(serialized.includes('Example Company'));
  assert.ok(!serialized.includes('example_support'));
});
