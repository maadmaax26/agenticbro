/**
 * BrandGuardDraftsReview.tsx — Outreach Drafts approval console (the gate)
 * ========================================================================
 * Tab 1 of the CRM approval spec (docs/crm-approval-tabs-spec.md). This is the
 * human-in-the-loop gate: the agent finds, scores, routes and drafts — but
 * NOTHING leaves the building until a human approves it here.
 *
 * Data contract (mirrors the Python store, db/store.py):
 *   GET  /api/brand-guard/admin/review-queue          → { available, drafts: Draft[] }
 *   POST /api/brand-guard/admin/apply-approvals        → { log: string[] }
 *   POST /api/brand-guard/admin/send-approved-drafts   → { created, skipped, failed, results[] }
 *
 * Approving a draft flips its approval state server-side. The "Send to Gmail"
 * button then calls the send worker, which creates Gmail drafts for all approved,
 * unsent email-channel (A/B) rows so the admin can review and fire them from Gmail.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types (the 24-key review-queue dict) ────────────────────────────────────
interface Signal {
  source?: string;
  signal_type?: string;
  snippet?: string;
  signal_url?: string;
  impersonated_brand?: string;
  incident_date?: string;
}

interface Draft {
  draft_id: string;
  company_name: string | null;
  primary_domain: string | null;
  vertical: string | null;
  company_size_band: string | null;
  compliance_region: string | null;
  compliance_ok: boolean;
  victim_score: number;
  score_breakdown: Record<string, number> | null;
  channel: string;
  routing_reason: string | null;
  subject: string | null;
  body: string;
  edited_body: string | null;
  opt_out_line: string | null;
  send_by_hand: boolean;
  findings_used: Record<string, unknown> | null;
  contact_channel: string | null;
  contact_email: string | null;
  linkedin_url: string | null;
  approval: string;
  suppressed: boolean;
  created_at: string | null;
  signals: Signal[] | null;
}

const API_BASE = "/api/brand-guard/admin";

const CHANNEL_COLOR: Record<string, string> = {
  A: "#4ade80", // email — verified contact
  B: "#60a5fa", // email — role inbox
  C: "#a78bfa", // LinkedIn — send by hand
  D: "#fb923c", // form / other
  E: "#f87171",
};

const REGION_AMBER = new Set(["EU", "UK", "EEA", "GB"]);

// ── helpers ─────────────────────────────────────────────────────────────────
function relTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function scoreColor(score: number): string {
  if (score < 50) return "#f87171";
  if (score < 70) return "#facc15";
  return "#4ade80";
}

function rgba(hex: string, a: number): string {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return hex;
  const [r, g, b] = m.map(h => parseInt(h, 16));
  return `rgba(${r},${g},${b},${a})`;
}

// ── component ───────────────────────────────────────────────────────────────
export default function BrandGuardDraftsReview({ authToken }: { authToken: string | null }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [channelOverride, setChannelOverride] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ created: number; skipped: number; failed: number } | null>(null);
  const [toast, setToast] = useState("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const selected = drafts.find(d => d.draft_id === selectedId) || null;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const load = useCallback(async () => {
    if (!authToken) { setLoading(false); setError("Not authenticated."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/review-queue?limit=100`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load review queue");
      if (data.available === false) {
        setAvailable(false);
        setNotice(data.message || "Review tables not provisioned.");
        setDrafts([]);
      } else {
        setAvailable(true);
        const sorted = [...(data.drafts || [])].sort((a: Draft, b: Draft) => b.victim_score - a.victim_score);
        setDrafts(sorted);
        if (sorted.length && !sorted.find(d => d.draft_id === selectedId)) {
          setSelectedId(sorted[0].draft_id);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, [authToken, selectedId]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [authToken]);

  // Sync editor + overrides when selection changes
  useEffect(() => {
    if (selected) {
      setEditBody(selected.edited_body ?? selected.body ?? "");
      setChannelOverride(selected.channel || "");
      setRejectReason("");
    }
  }, [selectedId]); // eslint-disable-line

  const applyDecision = useCallback(async (decision: "approve" | "reject", extra: Record<string, unknown> = {}) => {
    if (!selected || !authToken) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { draft_id: selected.draft_id, decision, ...extra };
      const res = await fetch(`${API_BASE}/apply-approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ decisions: [payload] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply decision");
      if (data.available === false) { setAvailable(false); setNotice(data.message || ""); return; }
      showToast((data.log && data.log[0]) || `${decision} applied`);
      // remove the decided draft locally + advance selection
      setDrafts(prev => {
        const idx = prev.findIndex(d => d.draft_id === selected.draft_id);
        const next = prev.filter(d => d.draft_id !== selected.draft_id);
        const newSel = next[Math.min(idx, next.length - 1)];
        setSelectedId(newSel ? newSel.draft_id : null);
        return next;
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }, [selected, authToken]);

  const approve = () => {
    if (!selected) return;
    const extra: Record<string, unknown> = {};
    const trimmed = editBody.trim();
    if (trimmed && trimmed !== (selected.body || "").trim()) extra.edited_body = editBody;
    if (channelOverride && channelOverride !== selected.channel) extra.channel = channelOverride;
    applyDecision("approve", extra);
  };

  const sendApproved = async () => {
    if (!authToken || sending) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`${API_BASE}/send-approved-drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      if (data.error) throw new Error(data.error);
      const created = data.created ?? 0;
      const skipped = data.skipped ?? 0;
      const failed = data.failed ?? 0;
      setSendResult({ created, skipped, failed });
      showToast(created > 0
        ? `✉ ${created} Gmail draft${created !== 1 ? "s" : ""} created — check your Drafts folder`
        : skipped > 0
        ? `↷ No new drafts — ${skipped} already sent or no email address`
        : "No approved email drafts found to send"
      );
    } catch (e) {
      showToast(`⚠ ${e instanceof Error ? e.message : "Send failed"}`);
    } finally {
      setSending(false);
    }
  };

  const reject = (suppress: boolean) => {
    if (!selected) return;
    if (!rejectReason.trim()) { showToast("Enter a reject reason first"); return; }
    const extra: Record<string, unknown> = { reason: rejectReason };
    if (suppress) {
      const value = selected.contact_email || selected.primary_domain;
      const match_type = selected.contact_email ? "email" : "domain";
      if (value) extra.suppress = { match_type, value };
    }
    applyDecision("reject", extra);
  };

  // Keyboard shortcuts: A approve, R reject, E focus editor, J/K next/prev
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (!available || !selected) return;
      const idx = drafts.findIndex(d => d.draft_id === selectedId);
      if (e.key === "j" || e.key === "J") { const n = drafts[idx + 1]; if (n) setSelectedId(n.draft_id); }
      else if (e.key === "k" || e.key === "K") { const p = drafts[idx - 1]; if (p) setSelectedId(p.draft_id); }
      else if (e.key === "e" || e.key === "E") { e.preventDefault(); editorRef.current?.focus(); }
      else if (e.key === "a" || e.key === "A") {
        if (!selected.suppressed && selected.compliance_ok) approve();
      } else if (e.key === "r" || e.key === "R") {
        if (rejectReason.trim()) reject(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-bind each render so closures see fresh state

  // ── styles (mirror BrandGuardProspectHunter) ──────────────────────────────
  const S = {
    wrap: { fontFamily: "'DM Mono','Courier New',monospace", color: "#c9d1d9", display: "grid", gridTemplateColumns: "minmax(300px,380px) 1fr", gap: 14, minHeight: 560 },
    panel: { background: "#0d1117", border: "1px solid #161b22", borderRadius: 8 },
    listHdr: { padding: "10px 14px", borderBottom: "1px solid #161b22", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#6b7280" },
    row: (active: boolean) => ({ padding: "10px 14px", borderBottom: "1px solid #161b22", cursor: "pointer", background: active ? "rgba(74,222,128,0.06)" : "transparent", borderLeft: `2px solid ${active ? "#4ade80" : "transparent"}` }),
    pill: (color: string) => ({ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: rgba(color, 0.14), color, border: `1px solid ${rgba(color, 0.35)}` }),
    chip: (color: string) => ({ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: rgba(color, 0.1), color, border: `1px solid ${rgba(color, 0.3)}`, display: "inline-block" as const, margin: "0 5px 5px 0" }),
    label: { fontSize: 10, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 },
    textarea: { width: "100%", minHeight: 220, background: "#06090d", border: "1px solid #21262d", borderRadius: 6, padding: 12, fontSize: 12, lineHeight: 1.6, color: "#c9d1d9", outline: "none", fontFamily: "'DM Mono',monospace", boxSizing: "border-box" as const, resize: "vertical" as const },
    input: { background: "#161b22", border: "1px solid #21262d", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#c9d1d9", outline: "none", fontFamily: "'DM Mono',monospace" },
    btn: (color: string, ghost = false) => ({ fontSize: 11, padding: "8px 16px", background: ghost ? "transparent" : rgba(color, 0.12), border: `1px solid ${rgba(color, ghost ? 0.2 : 0.45)}`, borderRadius: 6, color: ghost ? "#6b7280" : color, cursor: "pointer", fontFamily: "'DM Mono',monospace", display: "inline-flex" as const, alignItems: "center", gap: 6 }),
    btnDisabled: { fontSize: 11, padding: "8px 16px", background: "rgba(107,114,128,0.08)", border: "1px solid rgba(107,114,128,0.2)", borderRadius: 6, color: "#4b5563", cursor: "not-allowed", fontFamily: "'DM Mono',monospace" },
    banner: (color: string) => ({ background: rgba(color, 0.08), border: `1px solid ${rgba(color, 0.3)}`, borderRadius: 6, padding: "9px 12px", fontSize: 11, color, marginBottom: 12 }),
  };

  // ── empty / loading / error states ────────────────────────────────────────
  if (loading) {
    return <div style={{ fontFamily: "'DM Mono',monospace", color: "#6b7280", fontSize: 12, padding: 40, textAlign: "center" }}>Loading review queue…</div>;
  }
  if (!available) {
    return (
      <div style={{ ...S.panel, padding: 28, fontFamily: "'DM Mono',monospace" }}>
        <div style={{ fontSize: 13, color: "#facc15", marginBottom: 10 }}>⚠ Review tables not provisioned</div>
        <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7, marginBottom: 14 }}>{notice}</div>
        <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.7 }}>
          The Drafts approval console reads <code style={{ color: "#c9d1d9" }}>outreach_drafts</code>,{" "}
          <code style={{ color: "#c9d1d9" }}>prospects</code>, <code style={{ color: "#c9d1d9" }}>signals</code> and{" "}
          <code style={{ color: "#c9d1d9" }}>suppression_list</code>. Apply{" "}
          <code style={{ color: "#c9d1d9" }}>db/schema.sql</code> from the brand-guard-agent project, then reload.
        </div>
        <button onClick={load} style={{ ...S.btn("#4ade80"), marginTop: 16 }}>↻ Retry</button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 99, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", fontSize: 11, padding: "8px 14px", borderRadius: 6, fontFamily: "'DM Mono',monospace", maxWidth: 360 }}>{toast}</div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" as const }}>
        <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "'DM Mono',monospace" }}>
          Drafts awaiting approval · <span style={{ color: "#4ade80" }}>{drafts.length}</span>
          {sendResult && (
            <span style={{ marginLeft: 12, color: sendResult.created > 0 ? "#4ade80" : "#6b7280" }}>
              · last send: {sendResult.created} created, {sendResult.skipped} skipped, {sendResult.failed} failed
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={sendApproved}
            disabled={sending}
            title="Create Gmail drafts for all approved email-channel outreach (channels A and B). Check your Gmail Drafts folder after."
            style={sending ? S.btnDisabled : S.btn("#a78bfa")}
          >
            {sending ? "⏳ Sending…" : "✉ Send Approved to Gmail"}
          </button>
          <button onClick={load} style={S.btn("#60a5fa", true)}>↻ Refresh</button>
        </div>
      </div>

      {error && <div style={S.banner("#f87171")}>{error}</div>}

      {drafts.length === 0 ? (
        <div style={{ ...S.panel, padding: 40, textAlign: "center", color: "#6b7280", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
          ✓ Queue is empty — no drafts are waiting for review.
        </div>
      ) : (
        <div style={S.wrap}>
          {/* ── list pane ─────────────────────────────────────────────── */}
          <div style={{ ...S.panel, overflow: "hidden", alignSelf: "start" }}>
            <div style={S.listHdr}><span>QUEUE · score desc</span><span>{drafts.length}</span></div>
            <div style={{ maxHeight: 620, overflowY: "auto" }}>
              {drafts.map(d => {
                const active = d.draft_id === selectedId;
                const cc = CHANNEL_COLOR[d.channel] || "#9ca3af";
                const region = (d.compliance_region || "").toUpperCase();
                const amber = REGION_AMBER.has(region);
                return (
                  <div key={d.draft_id} style={S.row(active)} onClick={() => setSelectedId(d.draft_id)}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "#e6edf3", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.company_name || "—"}</div>
                      <span style={S.pill(cc)}>{d.channel || "?"}{d.send_by_hand ? " ✋" : ""}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7280", margin: "3px 0 7px" }}>{d.primary_domain || "—"}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: "#161b22", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, d.victim_score))}%`, height: "100%", background: scoreColor(d.victim_score) }} />
                      </div>
                      <span style={{ fontSize: 10, color: scoreColor(d.victim_score), minWidth: 22, textAlign: "right" }}>{d.victim_score}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 9, color: "#6b7280" }}>
                      {d.vertical && <span>{d.vertical}</span>}
                      {region && <span style={{ color: amber ? "#facc15" : "#6b7280" }}>{amber ? "⚠ " : ""}{region}</span>}
                      <span style={{ marginLeft: "auto" }}>{relTime(d.created_at)}</span>
                    </div>
                    {d.suppressed && <div style={{ fontSize: 9, color: "#f87171", marginTop: 4 }}>⛔ suppressed</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── detail pane ───────────────────────────────────────────── */}
          {selected ? (
            <div style={{ ...S.panel, padding: 18 }}>
              {/* header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, color: "#fff", fontWeight: "bold" }}>{selected.company_name || "—"}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    {selected.primary_domain || "—"}
                    {selected.contact_email && <span> · {selected.contact_email}</span>}
                    {selected.company_size_band && <span> · {selected.company_size_band}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, color: scoreColor(selected.victim_score), fontWeight: "bold" }}>{selected.victim_score}</div>
                  <div style={{ fontSize: 9, color: "#6b7280" }}>victim score</div>
                </div>
              </div>

              {/* guardrail banners */}
              {selected.suppressed && <div style={S.banner("#f87171")}>⛔ This prospect is on the suppression list — Approve is disabled.</div>}
              {!selected.compliance_ok && <div style={S.banner("#f87171")}>⛔ compliance_ok = false — Approve is disabled until compliance clears.</div>}
              {selected.victim_score < 50 && <div style={S.banner("#facc15")}>⚠ Below route threshold (score &lt; 50) — why is this here? Check the evidence before approving.</div>}
              {REGION_AMBER.has((selected.compliance_region || "").toUpperCase()) && (
                <div style={S.banner("#facc15")}>⚠ EU/UK prospect — legitimate-interest basis + published-contact rule apply. Extra care.</div>
              )}

              {/* 1. why this prospect — score_breakdown chips */}
              <div style={{ marginBottom: 16 }}>
                <div style={S.label}>Why this prospect — evidence trail</div>
                <div>
                  {selected.score_breakdown && Object.keys(selected.score_breakdown).length > 0
                    ? Object.entries(selected.score_breakdown).map(([k, v]) => (
                        <span key={k} style={S.chip(v >= 0 ? "#4ade80" : "#f87171")}>{k} {v >= 0 ? "+" : ""}{v}</span>
                      ))
                    : <span style={{ fontSize: 11, color: "#6b7280" }}>no score breakdown — treat as thin evidence</span>}
                </div>
              </div>

              {/* 2. evidence list — signals */}
              <div style={{ marginBottom: 16 }}>
                <div style={S.label}>Evidence ({selected.signals?.length || 0})</div>
                {(selected.signals || []).length === 0 && <div style={{ fontSize: 11, color: "#6b7280" }}>no signals attached</div>}
                {(selected.signals || []).map((s, i) => (
                  <div key={i} style={{ background: "#06090d", border: "1px solid #161b22", borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                      <span style={S.pill("#60a5fa")}>{s.source || "?"}</span>
                      {s.signal_type && <span style={{ fontSize: 9, color: "#6b7280" }}>{s.signal_type}</span>}
                      {s.signal_url && (
                        <a href={s.signal_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", fontSize: 10, color: "#4ade80", textDecoration: "none" }}>verify ↗</a>
                      )}
                    </div>
                    {s.snippet && <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>{s.snippet}</div>}
                  </div>
                ))}
              </div>

              {/* 3. routing reason */}
              {selected.routing_reason && (
                <div style={{ marginBottom: 16 }}>
                  <div style={S.label}>Routing reason</div>
                  <div style={{ fontSize: 11, color: "#c9d1d9" }}>{selected.routing_reason}</div>
                </div>
              )}

              {/* 4. the draft (editable) */}
              <div style={{ marginBottom: 16 }}>
                <div style={S.label}>Draft — subject</div>
                <div style={{ fontSize: 12, color: "#e6edf3", marginBottom: 10, padding: "6px 0" }}>{selected.subject || <span style={{ color: "#6b7280" }}>(no subject)</span>}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={S.label}>Body {selected.edited_body ? <span style={{ color: "#facc15" }}>· edited</span> : null}</div>
                  <div style={{ fontSize: 9, color: "#4b5563" }}>original preserved · edits → edited_body</div>
                </div>
                <textarea ref={editorRef} style={S.textarea} value={editBody} onChange={e => setEditBody(e.target.value)} />
                {selected.opt_out_line && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6, fontStyle: "italic" }}>{selected.opt_out_line}</div>}
              </div>

              {/* 5. findings used */}
              <div style={{ marginBottom: 16 }}>
                <div style={S.label}>Findings used — the only facts the model may cite</div>
                <pre style={{ background: "#06090d", border: "1px solid #161b22", borderRadius: 6, padding: 10, fontSize: 10, color: "#9ca3af", overflowX: "auto", margin: 0, lineHeight: 1.5 }}>
                  {selected.findings_used && Object.keys(selected.findings_used).length > 0
                    ? JSON.stringify(selected.findings_used, null, 2)
                    : "{}"}
                </pre>
              </div>

              {/* 6. compliance strip */}
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 10, color: "#6b7280", padding: "10px 0", borderTop: "1px solid #161b22", marginBottom: 14 }}>
                <span>suppressed: <span style={{ color: selected.suppressed ? "#f87171" : "#4ade80" }}>{String(selected.suppressed)}</span></span>
                <span>compliance_ok: <span style={{ color: selected.compliance_ok ? "#4ade80" : "#f87171" }}>{String(selected.compliance_ok)}</span></span>
                <span>region: <span style={{ color: "#c9d1d9" }}>{selected.compliance_region || "—"}</span></span>
                <span>channel: <span style={{ color: "#c9d1d9" }}>{selected.channel || "—"}</span>{selected.send_by_hand && <span style={{ color: "#a78bfa" }}> (send by hand)</span>}</span>
              </div>

              {/* actions */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>channel</span>
                  <select value={channelOverride} onChange={e => setChannelOverride(e.target.value)} style={S.input}>
                    {["A", "B", "C", "D"].map(c => <option key={c} value={c}>{c}{c === "C" ? " — LinkedIn (by hand)" : ""}</option>)}
                  </select>
                </div>

                {selected.suppressed || !selected.compliance_ok ? (
                  <span style={S.btnDisabled} title="Approve disabled by guardrail">✓ Approve (blocked)</span>
                ) : (
                  <button disabled={busy} style={S.btn("#4ade80")} onClick={approve}>
                    ✓ Approve{(editBody.trim() && editBody.trim() !== (selected.body || "").trim()) ? " with edits" : ""}{(channelOverride && channelOverride !== selected.channel) ? ` → ${channelOverride}` : ""} & queue
                  </button>
                )}

                <input style={{ ...S.input, flex: 1, minWidth: 160 }} placeholder="reject reason (required)…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                <button disabled={busy} style={S.btn("#fb923c", true)} onClick={() => reject(false)}>✕ Reject</button>
                <button disabled={busy} style={S.btn("#f87171")} onClick={() => reject(true)}>⛔ Reject + suppress</button>
              </div>
              <div style={{ fontSize: 9, color: "#4b5563", marginTop: 10 }}>keys: A approve · R reject · E edit · J/K next/prev</div>
            </div>
          ) : (
            <div style={{ ...S.panel, padding: 40, textAlign: "center", color: "#6b7280", fontSize: 12 }}>Select a draft to review.</div>
          )}
        </div>
      )}
    </div>
  );
}
