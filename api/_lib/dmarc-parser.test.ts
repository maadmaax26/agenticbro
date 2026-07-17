import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, zipSync } from 'fflate';
import { decompressDmarcAttachment, MAX_DMARC_XML_BYTES, parseDmarcXml } from './dmarc-parser.js';

const XML = `<?xml version="1.0"?>
<feedback>
  <report_metadata><org_name>Example Reporter</org_name><report_id>report-123</report_id><date_range><begin>1710000000</begin><end>1710086400</end></date_range></report_metadata>
  <record><row><source_ip>203.0.113.8</source_ip><count>120</count><policy_evaluated><disposition>reject</disposition><dkim>fail</dkim><spf>fail</spf></policy_evaluated></row></record>
  <record><row><source_ip>198.51.100.4</source_ip><count>5</count><policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>pass</spf></policy_evaluated></row></record>
</feedback>`;

test('parses DMARC metadata and unauthorized volume', () => {
  const report = parseDmarcXml(XML);
  assert.equal(report.reportId, 'report-123');
  assert.equal(report.messageCount, 125);
  assert.equal(report.failedCount, 120);
  assert.equal(report.sources[0].unauthorized, true);
});

test('decompresses bounded gzip and zip reports', () => {
  const bytes = new TextEncoder().encode(XML);
  assert.equal(decompressDmarcAttachment('report.xml.gz', gzipSync(bytes)), XML);
  assert.equal(decompressDmarcAttachment('report.zip', zipSync({ 'report.xml': bytes })), XML);
});

test('rejects oversized raw reports and multi-file ZIPs', () => {
  assert.throws(() => decompressDmarcAttachment('report.xml', new Uint8Array(MAX_DMARC_XML_BYTES + 1)), /size/i);
  const bytes = new TextEncoder().encode(XML);
  assert.throws(() => decompressDmarcAttachment('report.zip', zipSync({ 'one.xml': bytes, 'two.xml': bytes })), /exactly one XML/i);
});

test('rejects malformed DMARC XML', () => {
  assert.throws(() => parseDmarcXml('<feedback><record></feedback>'));
});
