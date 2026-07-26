export type BrandGuardContentScope = 'anonymized' | 'named';

export interface CompletedBrandGuardScan {
  id: string;
  owner_id: string | null;
  brand_name: string;
  status: string;
  completed_at: string | null;
  content_reuse_consent: boolean;
  content_reuse_scope: 'none' | BrandGuardContentScope;
  content_reuse_revoked_at: string | null;
  result: Record<string, unknown> | null;
}

export interface BrandGuardContentCandidate {
  scan_id: string;
  owner_id: string;
  status: 'new';
  content_scope: BrandGuardContentScope;
  finding_type: 'social_impersonation';
  safe_summary: {
    source: 'website_scan';
    finding_type: 'social_impersonation';
    total_findings: number;
    high_risk_count: number;
    critical_count: number;
    platforms: string[];
    scan_completed_at: string;
    brand_name?: string;
  };
  draft_copy: string;
  draft_hashtags: string[];
  draft_image_spec: string;
  safety_flags: string[];
}

const SAFE_PLATFORMS = new Set([
  'x', 'instagram', 'tiktok', 'facebook', 'telegram', 'linkedin',
]);

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];
}

function cleanBrandName(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function buildBrandGuardContentCandidate(
  scan: CompletedBrandGuardScan,
): BrandGuardContentCandidate | null {
  if (
    scan.status !== 'complete'
    || !scan.owner_id
    || !scan.completed_at
    || !scan.content_reuse_consent
    || scan.content_reuse_revoked_at
    || !scan.result
    || scan.result.real_scan !== true
    || scan.result.real_scan_pending === true
  ) {
    return null;
  }

  const findings = records(scan.result.impersonators ?? scan.result.impersonator_results);
  const eligible = findings.filter((finding) => {
    const level = String(finding.risk_level || '').toUpperCase();
    return level === 'HIGH' || level === 'CRITICAL';
  });
  if (!eligible.length) return null;

  const criticalCount = eligible.filter(
    finding => String(finding.risk_level || '').toUpperCase() === 'CRITICAL',
  ).length;
  const platforms = [...new Set(
    eligible
      .map(finding => String(finding.platform || '').toLowerCase())
      .filter(platform => SAFE_PLATFORMS.has(platform)),
  )].sort();
  const scope: BrandGuardContentScope = scan.content_reuse_scope === 'named'
    ? 'named'
    : 'anonymized';
  const brandName = cleanBrandName(scan.brand_name);
  const subject = scope === 'named' && brandName ? brandName : 'a monitored business';
  const platformText = platforms.length
    ? platforms.map(platform => platform === 'x' ? 'X' : platform[0].toUpperCase() + platform.slice(1)).join(', ')
    : 'monitored social platforms';
  const countText = `${eligible.length} high-risk potential impersonator account${eligible.length === 1 ? '' : 's'}`;

  return {
    scan_id: scan.id,
    owner_id: scan.owner_id,
    status: 'new',
    content_scope: scope,
    finding_type: 'social_impersonation',
    safe_summary: {
      source: 'website_scan',
      finding_type: 'social_impersonation',
      total_findings: eligible.length,
      high_risk_count: eligible.length,
      critical_count: criticalCount,
      platforms,
      scan_completed_at: scan.completed_at,
      ...(scope === 'named' && brandName ? { brand_name: brandName } : {}),
    },
    draft_copy: [
      `Brand Guard monitoring identified ${countText} resembling ${subject} across ${platformText}.`,
      'The result was reviewed as a monitoring signal, not proof of fraud.',
      'Continuous scanning helps businesses identify suspicious brand use earlier and preserve evidence for manual review.',
    ].join(' '),
    draft_hashtags: ['BrandProtection', 'ImpersonationMonitoring', 'OnlineSafety'],
    draft_image_spec: 'An anonymized monitoring summary showing finding counts and platform categories; no handles, domains, or customer identifiers.',
    safety_flags: [],
  };
}
