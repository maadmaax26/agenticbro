import { spawn } from 'node:child_process';

export type LocalSocialPlatform = 'instagram' | 'tiktok' | 'facebook' | 'telegram' | 'linkedin';

export interface LocalSocialProfile {
  platform: LocalSocialPlatform;
  username: string;
  displayName: string;
  followers: number;
  verified: boolean;
  bio: string;
  profileUrl: string;
  scannerRiskScore: number;
  scannerRiskLevel: string;
  evidence: string[];
  rawStatus: 'found' | 'inaccessible' | 'not_found' | 'error';
}

export interface PlatformScanSummary {
  platform: LocalSocialPlatform;
  checked: number;
  found: LocalSocialProfile[];
  inaccessible: number;
  errors: number;
}

const DEFAULT_SCANNER_DIR = '/Users/efinney/.openclaw/workspace/scripts';
const MAX_OUTPUT_BYTES = 256 * 1024;

const SCRIPT_NAMES: Record<LocalSocialPlatform, string> = {
  instagram: 'scan-instagram.sh',
  tiktok: 'scan-tiktok-command.sh',
  facebook: 'scan-facebook.sh',
  telegram: 'scan-telegram.sh',
  linkedin: 'scan-linkedIn.sh',
};

const PROFILE_URLS: Record<LocalSocialPlatform, (username: string) => string> = {
  instagram: username => `https://www.instagram.com/${username}/`,
  tiktok: username => `https://www.tiktok.com/@${username}`,
  facebook: username => `https://www.facebook.com/${username}`,
  telegram: username => `https://t.me/${username}`,
  linkedin: username => `https://www.linkedin.com/in/${username}/`,
};

function firstMatch(output: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

export function parseScannerOutput(
  platform: LocalSocialPlatform,
  username: string,
  output: string,
  exitCode: number | null,
): LocalSocialProfile {
  const inaccessiblePattern = /login wall|profile inaccessible|profile not found|could not resolve|not found or unreachable|no data retrieved|requires authentication/i;
  const notFoundPattern = /page not found|couldn't find this account|user not found/i;
  const scoreText = firstMatch(output, [
    /Risk Score:\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*10/i,
    /"risk_score"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
  ]);
  const score = scoreText ? Number(scoreText) : 0;
  const level = firstMatch(output, [
    /Risk Score:[^\n]*(?:—|-)\s*(LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN|ERROR)/i,
    /Risk Level:\s*(LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN|ERROR)/i,
    /"risk_level"\s*:\s*"([^"]+)"/i,
  ]).toUpperCase() || 'UNKNOWN';
  const displayName = firstMatch(output, [
    /Display Name:\s*([^\n]+)/i,
    /Name:\s*([^\n]+)/i,
  ]) || username;
  const bio = firstMatch(output, [/Bio:\s*([^\n]+)/i, /Headline:\s*([^\n]+)/i]);
  const followersText = firstMatch(output, [/Followers:\s*([0-9,]+)/i]);
  const followers = followersText ? Number(followersText.replace(/,/g, '')) : 0;
  const verified = /Verified:\s*(?:Yes|True)|Premium:\s*Yes/i.test(output);

  let rawStatus: LocalSocialProfile['rawStatus'] = 'found';
  if (notFoundPattern.test(output)) rawStatus = 'not_found';
  else if (inaccessiblePattern.test(output)) rawStatus = 'inaccessible';
  else if (exitCode !== 0 || /scan error|parse error|scanner not found/i.test(output)) rawStatus = 'error';
  else if (!scoreText && !/Display Name:|Name:|Username:|Account:/i.test(output)) rawStatus = 'inaccessible';

  const evidence = output
    .split('\n')
    .map(line => line.trim())
    .filter(line => /(?:🚩|•|red flag|risk score|verified|followers|bio:|headline:)/i.test(line))
    .slice(0, 12);

  return {
    platform,
    username,
    displayName,
    followers,
    verified,
    bio,
    profileUrl: PROFILE_URLS[platform](username),
    scannerRiskScore: score,
    scannerRiskLevel: level,
    evidence,
    rawStatus,
  };
}

async function runWrapper(
  platform: LocalSocialPlatform,
  username: string,
  timeoutMs: number,
): Promise<LocalSocialProfile> {
  const scannerDir = process.env.BRAND_GUARD_SCANNER_DIR || DEFAULT_SCANNER_DIR;
  const scriptPath = `${scannerDir}/${SCRIPT_NAMES[platform]}`;

  return new Promise(resolve => {
    const child = spawn('bash', [scriptPath, username], {
      env: { ...process.env, BRAND_GUARD_JSON: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;

    const append = (chunk: Buffer) => {
      if (output.length < MAX_OUTPUT_BYTES) output += chunk.toString('utf8');
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);

    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(parseScannerOutput(platform, username, output, code));
    };

    child.on('error', error => {
      output += `\nScanner error: ${error.message}`;
      finish(1);
    });
    child.on('close', finish);

    const timer = setTimeout(() => {
      output += `\nScanner error: timed out after ${timeoutMs}ms`;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 1000).unref();
      finish(124);
    }, timeoutMs);
  });
}

export async function scanVariantsLocally(
  platform: LocalSocialPlatform,
  variants: string[],
  options: { maxVariants?: number; concurrency?: number; timeoutMs?: number } = {},
): Promise<PlatformScanSummary> {
  const maxVariants = options.maxVariants ?? Number(process.env.BRAND_GUARD_LOCAL_VARIANTS || 5);
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const timeoutMs = options.timeoutMs ?? 45_000;
  const queue = variants.slice(0, maxVariants);
  const results: LocalSocialProfile[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const index = cursor++;
      results[index] = await runWrapper(platform, queue[index], timeoutMs);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
  return {
    platform,
    checked: results.length,
    found: results.filter(result => result.rawStatus === 'found'),
    inaccessible: results.filter(result => result.rawStatus === 'inaccessible' || result.rawStatus === 'not_found').length,
    errors: results.filter(result => result.rawStatus === 'error').length,
  };
}
