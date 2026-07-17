const WATCH_TLDS = ['com', 'net', 'org', 'io', 'co', 'app', 'xyz', 'site', 'online'];
const HOMOGLYPHS: Record<string, string[]> = { a: ['4'], e: ['3'], i: ['1', 'l'], l: ['1', 'i'], o: ['0'], s: ['5'], t: ['7'] };

export function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].replace(/\.$/, '');
}

export function generateWatchDomains(primaryDomain: string, limit = 40): string[] {
  const normalized = normalizeDomain(primaryDomain);
  const labels = normalized.split('.');
  if (labels.length < 2) return [];
  const tld = labels.pop()!;
  const base = labels.join('.');
  const variants = new Set<string>();
  const add = (domain: string) => {
    if (domain !== normalized && /^[a-z0-9.-]+$/.test(domain) && !domain.includes('..')) variants.add(domain);
  };

  for (const candidateTld of WATCH_TLDS) if (candidateTld !== tld) add(`${base}.${candidateTld}`);
  for (let i = 0; i < base.length; i++) {
    if (base[i] !== '.') add(`${base.slice(0, i)}${base.slice(i + 1)}.${tld}`);
    if (i < base.length - 1 && base[i] !== '.' && base[i + 1] !== '.') {
      add(`${base.slice(0, i)}${base[i + 1]}${base[i]}${base.slice(i + 2)}.${tld}`);
    }
    for (const replacement of HOMOGLYPHS[base[i]] || []) {
      add(`${base.slice(0, i)}${replacement}${base.slice(i + 1)}.${tld}`);
    }
  }
  for (const prefix of ['login-', 'secure-', 'support-', 'verify-']) add(`${prefix}${base}.${tld}`);
  for (const suffix of ['-login', '-secure', '-support', '-verify']) add(`${base}${suffix}.${tld}`);
  return [...variants].slice(0, Math.max(1, Math.min(limit, 100)));
}

export function dnsTransition(previous: { resolves: boolean; mx_records?: string[] } | null, current: { resolves: boolean; mx_records: string[] }): 'activated' | 'mx_added' | null {
  if (current.resolves && previous && !previous.resolves) return 'activated';
  if (current.mx_records.length > 0 && (!previous || (previous.mx_records || []).length === 0)) return 'mx_added';
  return null;
}
