import { gunzipSync, unzipSync } from 'fflate';
import { SaxesParser } from 'saxes';

export const MAX_DMARC_XML_BYTES = 10 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;

function assertZipSafe(data: Uint8Array): void {
  let entries = 0;
  let totalUncompressed = 0;
  for (let offset = 0; offset + 46 <= data.length; offset++) {
    if (data[offset] !== 0x50 || data[offset + 1] !== 0x4b || data[offset + 2] !== 0x01 || data[offset + 3] !== 0x02) continue;
    const view = new DataView(data.buffer, data.byteOffset + offset, 46);
    const compressed = view.getUint32(20, true);
    const uncompressed = view.getUint32(24, true);
    const nameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    if (uncompressed > MAX_DMARC_XML_BYTES || (compressed > 0 && uncompressed / compressed > MAX_COMPRESSION_RATIO)) {
      throw new Error('DMARC ZIP entry exceeds decompression safety limits');
    }
    totalUncompressed += uncompressed;
    entries++;
    if (entries > 10 || totalUncompressed > MAX_DMARC_XML_BYTES) throw new Error('DMARC ZIP archive exceeds extraction limits');
    offset += 45 + nameLength + extraLength + commentLength;
  }
  if (entries === 0) throw new Error('DMARC ZIP central directory is missing or unsupported');
}

export function decompressDmarcAttachment(filename: string, input: Uint8Array): string {
  if (input.byteLength === 0 || input.byteLength > MAX_DMARC_XML_BYTES) throw new Error('DMARC attachment size is invalid');
  const lower = filename.toLowerCase();
  let xmlBytes: Uint8Array;
  if (lower.endsWith('.gz') || (input[0] === 0x1f && input[1] === 0x8b)) {
    if (input.length < 4) throw new Error('Invalid GZIP payload');
    const declaredSize = new DataView(input.buffer, input.byteOffset + input.length - 4, 4).getUint32(0, true);
    if (declaredSize > MAX_DMARC_XML_BYTES || (declaredSize > 0 && declaredSize / input.length > MAX_COMPRESSION_RATIO)) {
      throw new Error('DMARC GZIP exceeds decompression safety limits');
    }
    xmlBytes = gunzipSync(input);
  } else if (lower.endsWith('.zip') || (input[0] === 0x50 && input[1] === 0x4b)) {
    assertZipSafe(input);
    const files = unzipSync(input);
    const candidates = Object.entries(files).filter(([name]) => name.toLowerCase().endsWith('.xml'));
    if (candidates.length !== 1) throw new Error('DMARC ZIP must contain exactly one XML report');
    xmlBytes = candidates[0][1];
  } else {
    xmlBytes = input;
  }
  if (xmlBytes.byteLength > MAX_DMARC_XML_BYTES) throw new Error('Extracted DMARC XML exceeds 10 MB');
  return new TextDecoder('utf-8', { fatal: true }).decode(xmlBytes);
}

export interface DmarcSource {
  sourceIp: string;
  count: number;
  disposition: string;
  dkim: string;
  spf: string;
  unauthorized: boolean;
}

export interface DmarcReport {
  reportId: string;
  reporter: string;
  periodStart: string | null;
  periodEnd: string | null;
  messageCount: number;
  failedCount: number;
  sources: DmarcSource[];
}

export function parseDmarcXml(xml: string): DmarcReport {
  const parser = new SaxesParser({ xmlns: false });
  const path: string[] = [];
  let text = '';
  let reportId = '';
  let reporter = '';
  let begin = '';
  let end = '';
  let current: Partial<DmarcSource> | null = null;
  const sources: DmarcSource[] = [];

  parser.on('opentag', tag => { path.push(String(tag.name).toLowerCase()); text = ''; if (tag.name.toLowerCase() === 'record') current = {}; });
  parser.on('text', value => { text += value; });
  parser.on('cdata', value => { text += value; });
  parser.on('closetag', () => {
    const key = path.join('/');
    const value = text.trim();
    if (key.endsWith('report_metadata/report_id')) reportId = value;
    else if (key.endsWith('report_metadata/org_name')) reporter = value;
    else if (key.endsWith('date_range/begin')) begin = value;
    else if (key.endsWith('date_range/end')) end = value;
    else if (current && key.endsWith('row/source_ip')) current.sourceIp = value;
    else if (current && key.endsWith('row/count')) current.count = Math.max(0, Number.parseInt(value, 10) || 0);
    else if (current && key.endsWith('policy_evaluated/disposition')) current.disposition = value.toLowerCase();
    else if (current && key.endsWith('policy_evaluated/dkim')) current.dkim = value.toLowerCase();
    else if (current && key.endsWith('policy_evaluated/spf')) current.spf = value.toLowerCase();
    if (path[path.length - 1] === 'record' && current) {
      const source: DmarcSource = {
        sourceIp: current.sourceIp || '', count: current.count || 0,
        disposition: current.disposition || 'none', dkim: current.dkim || 'unknown', spf: current.spf || 'unknown',
        unauthorized: current.dkim === 'fail' && current.spf === 'fail',
      };
      if (source.sourceIp) sources.push(source);
      current = null;
    }
    path.pop(); text = '';
  });
  parser.write(xml).close();
  if (!reportId || sources.length === 0) throw new Error('DMARC XML is missing report metadata or records');
  const toIso = (epoch: string) => /^\d+$/.test(epoch) ? new Date(Number(epoch) * 1000).toISOString() : null;
  return {
    reportId, reporter, periodStart: toIso(begin), periodEnd: toIso(end), sources,
    messageCount: sources.reduce((sum, row) => sum + row.count, 0),
    failedCount: sources.filter(row => row.unauthorized).reduce((sum, row) => sum + row.count, 0),
  };
}
