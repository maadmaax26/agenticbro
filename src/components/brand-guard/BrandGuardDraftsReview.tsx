/**
 * BrandGuardDraftsReview.tsx — Outreach Drafts approval console
 * ========================================================================
 * Two-tab view:
 *   Pending Review  — unreviewed drafts; human approves/rejects here
 *   Approved Queue  — approved, unsent drafts; shows what will go to Gmail
 *
 * Data contract:
 *   GET  /api/brand-guard/admin/review-queue      → { available, drafts: Draft[] }
 *   GET  /api/brand-guard/admin/approved-drafts   → { available, drafts: Draft[] }
 *   POST /api/brand-guard/admin/apply-approvals   → { log: string[] }
 *   PATCH /api/brand-guard/admin/prospect         → { prospect: {...} }
 *
 * Gmail drafts are created by the Cowork scheduled task (openclaw/gmail MCP)
 * which polls /approved-drafts and uses the connected efinney@brandguardhq.com
 * account — no OAuth2 credentials needed in Vercel.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
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
  prospect_id: string | null;
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
  contact_name: string | null;
  linkedin_url: string | null;
  approval: string;
  suppressed: boolean;
  created_at: string | null;
  approved_at?: string | null;
  signals: Signal[] | null;
}

const API_BASE = "/api/brand-guard/admin";

const CHANNEL_COLOR: Record<string, string> = {
  A: "#4ade80",
  B: "#60a5fa",
  C: "#a78bfa",
  D: "#fb923c",
  E: "#f87171",
};

const REGION_AMBER = new Set(["EU", "UK", "EEA", "GB"]);

// ── helpers ──────────────────────────────────────────────────────────────────
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

/** Returns a warning string if the email looks like a registrar/abuse address */
function emailQualityWarning(email: string | null): string | null {
  if (!email) return null;
  const e = email.toLowerCase();
  if (e.includes("abuse@") || e.includes("domainabuse@") || e.includes("abusecomplaints@"))
    return "⚠ Registrar abuse address — update to a direct company contact before approving";
  if (e.startsWith("webmaster@"))
    return "⚠ Generic webmaster address — consider a decision-maker contact for better response rate";
  if (e.includes("@service.aliyun") || e.includes("@key-systems") || e.includes("@nameshield") || e.includes("@safebrands") || e.includes("@web.com"))
    return "⚠ Domain registrar contact — this will not reach the company";
  return null;
}

// ── component ────────────────────────────────────────────────────────────────
export default function BrandGuardDraftsReview({ authToken }: { authToken: string | null }) {
  // ── Pending view state ────────────────────────────────────────────────────
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

  // ── Approved view state ───────────────────────────────────────────────────
  const [view, setView] = useState<"pending" | "approved">("pending");
  const [approvedDrafts, setApprovedDrafts] = useState<Draft[]>([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [approvedSelectedId, setApprovedSelectedId] = useState<string | null>(null);

  // ── Contact email editor ──────────────────────────────────────────────────
  const [editContact, setEditContact] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ created: number; skipped: number; failed: number } | null>(null);
  const [toast, setToast] = useState("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const selected = drafts.find(d => d.draft_id === selectedId) || null;
  const approvedSelected = approvedDrafts.find(d => d.draft_id === approvedSelectedId) || null;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3200); };

  // ── Load pending ──────────────────────────────────────────────────────────
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
        if (sorted.length && !sorted.find((d: Draft) => d.draft_id === selectedId)) {
          setSelectedId(sorted[0].draft_id);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, [authToken, selectedId]);

  // ── Load approved ─────────────────────────────────────────────────────────
  const loadApproved = useCallback(async () => {
    if (!authToken) return;
    setApprovedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/approved-drafts?limit=100`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.available === false) { setAvailable(false); setNotice(data.message || ""); }
      else {
        setApprovedDrafts(data.drafts || []);
        if ((data.drafts || []).length && !approvedSelectedId) {
          setApprovedSelectedId(data.drafts[0].draft_id);
        }
      }
    } catch {} finally {
      setApprovedLoading(false);
    }
  }, [authToken, approvedSelectedId]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [authToken]);
  useEffect(() => { if (view === "approved") loadApproved(); /* eslint-disable-next-line */ }, [view]);

  // Sync editor when pending selection changes
  useEffect(() => {
    if (selected) {
      setEditBody(selected.edited_body ?? selected.body ?? "");
      setChannelOverride(selected.channel || "");
      setRejectReason("");
      setEditContact(selected.contact_email || "");
    }
  }, [selectedId]); // eslint-disable-line

  // Sync contact when approved selection changes
  useEffect(() => {
    if (approvedSelected) setEditContact(approvedSelected.contact_email || "");
  }, [approvedSelectedId]); // eslint-disable-line

  // ── Save contact email ────────────────────────────────────────────────────
  const saveContactEmail = async (draft: Draft) => {
    if (!draft.prospect_id || !authToken || savingContact) return;
    const email = editContact.trim();
    if (!email || !email.includes("@")) { showToast("Enter a valid email address"); return; }
    setSavingContact(true);
    try {
      const res = await fetch(`${API_BASE}/prospect`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ prospect_id: draft.prospect_id, contact_email: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      // Patch local state in both lists
      const patchList = (list: Draft[]) =>
        list.map(d => d.draft_id === draft.draft_id ? { ...d, contact_email: email } : d);
      setDrafts(patchList);
      setApprovedDrafts(patchList);
      showToast("✓ Contact email updated");
    } catch (e) {
      showToast(`⚠ ${e instanceof Error ? e.message : "Update failed"}`);
    } finally {
      setSavingContact(false);
    }
  };

  // ── Apply approve/reject ──────────────────────────────────────────────────
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
      setDrafts(prev => {
        const idx = prev.findIndex(d => d.draft_id === selected.draft_id);
        const next = prev.filter(d => d.draft_id !== selected.draft_id);
        const newSel = next[Math.min(idx, next.length - 1)];
        setSelectedId(newSel ? newSel.draft_id : null);
        return next;
      });
      // Refresh approved list in background so count updates
      loadApproved();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }, [selected, authToken, loadApproved]);

  const approve = () => {
    if (!selected) return;
    // If email was edited, save it first before approving
    if (editContact.trim() && editContact.trim() !== (selected.contact_email || "").trim()) {
      saveContactEmail(selected);
    }
    const extra: Record<string, unknown> = {};
    const trimmed = editBody.trim();
    if (trimmed && trimmed !== (selected.body || "").trim()) extra.edited_body = editBody;
    if (channelOverride && channelOverride !== selected.channel) extra.channel = channelOverride;
    applyDecision("approve", extra);
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

  // ── Send approved to Gmail ────────────────────────────────────────────────
  const sendApproved = async () => {
    if (!authToken || sending) return;
    setSending(true); setSendResult(null);
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
        ? `✉ ${created} Gmail draft${created !== 1 ? "s" : ""} created — check efinney@brandguardhq.com Drafts`
        : skipped > 0 ? `↷ ${skipped} already sent or no email address` : "No approved email drafts found");
      if (created > 0) loadApproved();
    } catch (e) {
      showToast(`⚠ ${e instanceof Error ? e.message : "Send failed"}`);
    } finally {
      setSending(false); }
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== "pending") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (!available || !selected) return;
      const idx = drafts.findIndex(d => d.draft_id === selectedId);
      if (e.key === "j" || e.key === "J") { const n = drafts[idx + 1]; if (n) setSelectedId(n.draft_id); }
      else if (e.key === "k" || e.key === "K") { const p = drafts[idx - 1]; if (p) setSelectedId(p.draft_id); }
      else if (e.key === "e" || e.key === "E") { e.preventDefault(); editorRef.current?.focus(); }
      else if (e.key === "a" || e.key === "A") { if (!selected.suppressed && selected.compliance_ok) approve(); }
      else if (e.key === "r" || e.key === "R") { if (rejectReason.trim()) reject(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-bind each render so closures see fresh state

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    wrap: { fontFamily: "'DM Mono','Courier New',monospace", color: "#c9d1d9", display: "grid", gridTemplateColumns: "minmax(280px,340px) 1fr", gap: 14, minHeight: 560 },
    panel: { background: "#0d1117", border: "1px solid #161b22", borderRadius: 8 },
    listHdr: { padding: "10px 14px", borderBottom: "1px solid #161b22", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#6b7280" },
    row: (active: boolean) => ({ padding: "10px 14px", borderBottom: "1px solid #161b22", cursor: "pointer", background: active ? "rgba(74,222,128,0.06)" : "transparent", borderLeft: `2px solid ${active ? "#4ade80" : "transparent"}` }),
    rowApproved: (active: boolean) => ({ padding: "10px 14px", borderBottom: "1px solid #161b22", cursor: "pointer", background: active ? "rgba(167,139,250,0.06)" : "transparent", borderLeft: `2px solid ${active ? "#a78bfa" : "transparent"}` }),
    pill: (color: string) => ({ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: rgba(color, 0.14), color, border: `1px solid ${rgba(color, 0.35)}` }),
    chip: (color: string) => ({ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: rgba(color, 0.1), color, border: `1px solid ${rgba(color, 0.3)}`, display: "inline-block" as const, margin: "0 5px 5px 0" }),
    label: { fontSize: 10, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 },
    textarea: { width: "100%", minHeight: 200, background: "#06090d", border: "1px solid #21262d", borderRadius: 6, padding: 12, fontSize: 12, lineHeight: 1.6, color: "#c9d1d9", outline: "none", fontFamily: "'DM Mono',monospace", boxSizing: "border-box" as const, resize: "vertical" as const },
    input: { background: "#161b22", border: "1px solid #21262d", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#c9d1d9", outline: "none", fontFamily: "'DM Mono',monospace" },
    btn: (color: string, ghost = false) => ({ fontSize: 11, padding: "8px 16px", background: ghost ? "transparent" : rgba(color, 0.12), border: `1px solid ${rgba(color, ghost ? 0.2 : 0.45)}`, borderRadius: 6, color: ghost ? "#6b7280" : color, cursor: "pointer", fontFamily: "'DM Mono',monospace", display: "inline-flex" as const, alignItems: "center", gap: 6 }),
    btnSm: (color: string) => ({ fontSize: 10, padding: "5px 10px", background: rgba(color, 0.1), border: `1px solid ${rgba(color, 0.4)}`, borderRadius: 5, color, cursor: "pointer", fontFamily: "'DM Mono',monospace" }),
    btnDisabled: { fontSize: 11, padding: "8px 16px", background: "rgba(107,114,128,0.08)", border: "1px solid rgba(107,114,128,0.2)", borderRadius: 6, color: "#4b5563", cursor: "not-allowed", fontFamily: "'DM Mono',monospace" },
    banner: (color: string) => ({ background: rgba(color, 0.08), border: `1px solid ${rgba(color, 0.3)}`, borderRadius: 6, padding: "9px 12px", fontSize: 11, color, marginBottom: 12 }),
    warn: { fontSize: 10, color: "#facc15", marginTop: 5, lineHeight: 1.5 } as const,
  };

  // ── Contact email editor block (shared between pending and approved views) ─
  const ContactEmailEditor = ({ draft }: { draft: Draft }) => {
    const warn = emailQualityWarning(editContact || draft.contact_email);
    const changed = editContact.trim() !== (draft.contact_email || "").trim();
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...S.label, display: "flex", alignItems: "center", gap: 6 }}>
          To / Contact email
          {!draft.contact_email && <span style={{ color: "#f87171" }}>· MISSING</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            style={{ ...S.input, flex: 1, borderColor: warn ? "rgba(250,204,21,0.4)" : "#21262d" }}
            value={editContact}
            onChange={e => setEditContact(e.target.value)}
            placeholder="contact@company.com"
          />
          {changed && (
            <button
              disabled={savingContact}
              onClick={() => saveContactEmail(draft)}
              style={savingContact ? S.btnDisabled : S.btn("#4ade80")}
            >
              {savingContact ? "…" : "✓ Save"}
            </button>
          )}
        </div>
        {warn && <div style={S.warn}>{warn}</div>}
        {draft.contact_name && (
          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>Contact: {draft.contact_name}</div>
        )}
        {draft.linkedin_url && (
          <div style={{ fontSize: 10, marginTop: 3 }}>
            <a href={draft.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>LinkedIn ↗</a>
          </div>
        )}
      </div>
    );
  };

  // ── Loading / unavailable states ──────────────────────────────────────────
  if (loading) return <div style={{ fontFamily: "'DM Mono',monospace", color: "#6b7280", fontSize: 12, padding: 40, textAlign: "center" }}>Loading review queue…</div>;

  if (!available) {
    return (
      <div style={{ ...S.panel, padding: 28, fontFamily: "'DM Mono',monospace" }}>
        <div style={{ fontSize: 13, color: "#facc15", marginBottom: 10 }}>⚠ Review tables not provisioned</div>
        <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7, marginBottom: 14 }}>{notice}</div>
        <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.7 }}>
          Apply <code style={{ color: "#c9d1d9" }}>db/schema.sql</code> from the brand-guard-agent project, then reload.
        </div>
        <button onClick={load} style={{ ...S.btn("#4ade80"), marginTop: 16 }}>↻ Retry</button>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", fontFamily: "'DM Mono','Courier New',monospace" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 99, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", fontSize: 11, padding: "8px 14px", borderRadius: 6, fontFamily: "'DM Mono',monospace", maxWidth: 380 }}>{toast}</div>
      )}

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" as const }}>
        {/* View tabs */}
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setView("pending")}
            style={{ ...S.btn(view === "pending" ? "#4ade80" : "#6b7280", view !== "pending"), fontWeight: view === "pending" ? "bold" : "normal" }}
          >
            Pending Review <span style={{ opacity: 0.7 }}>({drafts.length})</span>
          </button>
          <button
            onClick={() => setView("approved")}
            style={{ ...S.btn(view === "approved" ? "#a78bfa" : "#6b7280", view !== "approved"), fontWeight: view === "approved" ? "bold" : "normal" }}
          >
            Approved Queue <span style={{ opacity: 0.7 }}>({approvedDrafts.length})</span>
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {sendResult && (
            <span style={{ fontSize: 10, color: sendResult.created > 0 ? "#4ade80" : "#6b7280" }}>
              last send: {sendResult.created} created · {sendResult.skipped} skipped · {sendResult.failed} failed
            </span>
          )}
          <button
            onClick={sendApproved}
            disabled={sending}
            title="Create Gmail drafts in efinney@brandguardhq.com for all approved email-channel drafts (channels A + B)"
            style={sending ? S.btnDisabled : S.btn("#a78bfa")}
          >
            {sending ? "⏳ Sending…" : "✉ Send Approved to Gmail"}
          </button>
          <button onClick={() => { load(); if (view === "approved") loadApproved(); }} style={S.btn("#60a5fa", true)}>↻ Refresh</button>
        </div>
      </div>

      {error && <div style={S.banner("#f87171")}>{error}</div>}

      {/* ════════════════════════════════════════════════════════════════════
           PENDING VIEW
         ════════════════════════════════════════════════════════════════════ */}
      {view === "pending" && (
        drafts.length === 0 ? (
          <div style={{ ...S.panel, padding: 40, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
            ✓ Queue is empty — no drafts awaiting review.
          </div>
        ) : (
          <div style={S.wrap}>
            {/* List pane */}
            <div style={{ ...S.panel, overflow: "hidden", alignSelf: "start" }}>
              <div style={S.listHdr}><span>QUEUE · score desc</span><span>{drafts.length}</span></div>
              <div style={{ maxHeight: 600, overflowY: "auto" }}>
                {drafts.map(d => {
                  const active = d.draft_id === selectedId;
                  const cc = CHANNEL_COLOR[d.channel] || "#9ca3af";
                  const region = (d.compliance_region || "").toUpperCase();
                  const amber = REGION_AMBER.has(region);
                  const warn = emailQualityWarning(d.contact_email);
                  return (
                    <div key={d.draft_id} style={S.row(active)} onClick={() => setSelectedId(d.draft_id)}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontSize: 12, color: "#e6edf3", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.company_name || "—"}</div>
                        <span style={S.pill(cc)}>{d.channel || "?"}{d.send_by_hand ? " ✋" : ""}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7280", margin: "2px 0 4px" }}>{d.primary_domain || "—"}</div>
                      {d.contact_email && (
                        <div style={{ fontSize: 9, color: warn ? "#facc15" : "#4b5563", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {warn ? "⚠ " : ""}{d.contact_email}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: "#161b22", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(0, Math.min(100, d.victim_score))}%`, height: "100%", background: scoreColor(d.victim_score) }} />
                        </div>
                        <span style={{ fontSize: 10, color: scoreColor(d.victim_score), minWidth: 22, textAlign: "right" }}>{d.victim_score}</span>
                        {region && <span style={{ fontSize: 9, color: amber ? "#facc15" : "#4b5563" }}>{amber ? "⚠ " : ""}{region}</span>}
                        <span style={{ fontSize: 9, color: "#4b5563", marginLeft: "auto" }}>{relTime(d.created_at)}</span>
                      </div>
                      {d.suppressed && <div style={{ fontSize: 9, color: "#f87171", marginTop: 3 }}>⛔ suppressed</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detail pane */}
            {selected ? (
              <div style={{ ...S.panel, padding: 18, overflowY: "auto", maxHeight: "80vh" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 16, color: "#fff", fontWeight: "bold" }}>{selected.company_name || "—"}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      {selected.primary_domain || "—"}{selected.vertical && <span> · {selected.vertical}</span>}
                      {selected.company_size_band && <span> · {selected.company_size_band}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, color: scoreColor(selected.victim_score), fontWeight: "bold" }}>{selected.victim_score}</div>
                    <div style={{ fontSize: 9, color: "#6b7280" }}>victim score</div>
                  </div>
                </div>

                {/* Guardrail banners */}
                {selected.suppressed && <div style={S.banner("#f87171")}>⛔ Suppressed — Approve is disabled.</div>}
                {!selected.compliance_ok && <div style={S.banner("#f87171")}>⛔ compliance_ok = false — Approve is disabled.</div>}
                {selected.victim_score < 50 && <div style={S.banner("#facc15")}>⚠ Score &lt; 50 — check evidence before approving.</div>}
                {REGION_AMBER.has((selected.compliance_region || "").toUpperCase()) && (
                  <div style={S.banner("#facc15")}>⚠ EU/UK — legitimate-interest basis + published-contact rule apply.</div>
                )}

                {/* 1. Contact email (editable) */}
                <ContactEmailEditor draft={selected} />

                {/* 2. Score breakdown */}
                {selected.score_breakdown && Object.keys(selected.score_breakdown).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={S.label}>Why this prospect</div>
                    {Object.entries(selected.score_breakdown).map(([k, v]) => (
                      <span key={k} style={S.chip(v >= 0 ? "#4ade80" : "#f87171")}>{k} {v >= 0 ? "+" : ""}{v}</span>
                    ))}
                  </div>
                )}

                {/* 3. Evidence signals */}
                {(selected.signals || []).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={S.label}>Evidence ({selected.signals?.length})</div>
                    {(selected.signals || []).map((s, i) => (
                      <div key={i} style={{ background: "#06090d", border: "1px solid #161b22", borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                          <span style={S.pill("#60a5fa")}>{s.source || "?"}</span>
                          {s.signal_type && <span style={{ fontSize: 9, color: "#6b7280" }}>{s.signal_type}</span>}
                          {s.signal_url && <a href={s.signal_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", fontSize: 10, color: "#4ade80", textDecoration: "none" }}>verify ↗</a>}
                        </div>
                        {s.snippet && <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>{s.snippet}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. Routing reason */}
                {selected.routing_reason && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={S.label}>Routing reason</div>
                    <div style={{ fontSize: 11, color: "#c9d1d9" }}>{selected.routing_reason}</div>
                  </div>
                )}

                {/* 5. Draft body (editable) */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={S.label}>Subject</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#e6edf3", marginBottom: 10, padding: "6px 0" }}>{selected.subject || <span style={{ color: "#6b7280" }}>(no subject)</span>}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={S.label}>Body {selected.edited_body ? <span style={{ color: "#facc15" }}>· edited</span> : null}</div>
                    <div style={{ fontSize: 9, color: "#4b5563" }}>edits → edited_body</div>
                  </div>
                  <textarea ref={editorRef} style={S.textarea} value={editBody} onChange={e => setEditBody(e.target.value)} />
                  {selected.opt_out_line && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6, fontStyle: "italic" }}>{selected.opt_out_line}</div>}
                </div>

                {/* 6. Compliance strip */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 10, color: "#6b7280", padding: "8px 0", borderTop: "1px solid #161b22", marginBottom: 14 }}>
                  <span>suppressed: <span style={{ color: selected.suppressed ? "#f87171" : "#4ade80" }}>{String(selected.suppressed)}</span></span>
                  <span>compliance_ok: <span style={{ color: selected.compliance_ok ? "#4ade80" : "#f87171" }}>{String(selected.compliance_ok)}</span></span>
                  <span>region: <span style={{ color: "#c9d1d9" }}>{selected.compliance_region || "—"}</span></span>
                  <span>channel: <span style={{ color: "#c9d1d9" }}>{selected.channel || "—"}</span>{selected.send_by_hand && <span style={{ color: "#a78bfa" }}> (by hand)</span>}</span>
                </div>

                {/* 7. Actions */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>ch</span>
                    <select value={channelOverride} onChange={e => setChannelOverride(e.target.value)} style={{ ...S.input, padding: "5px 8px" }}>
                      {["A", "B", "C", "D"].map(c => <option key={c} value={c}>{c}{c === "C" ? " LinkedIn" : c === "D" ? " Form" : " Email"}</option>)}
                    </select>
                  </div>
                  {selected.suppressed || !selected.compliance_ok ? (
                    <span style={S.btnDisabled} title="Blocked by guardrail">✓ Approve (blocked)</span>
                  ) : (
                    <button disabled={busy} style={S.btn("#4ade80")} onClick={approve}>
                      ✓ Approve{(editBody.trim() && editBody.trim() !== (selected.body || "").trim()) ? " + edits" : ""}
                      {(channelOverride && channelOverride !== selected.channel) ? ` → ${channelOverride}` : ""}
                    </button>
                  )}
                  <input style={{ ...S.input, flex: 1, minWidth: 140 }} placeholder="reject reason…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                  <button disabled={busy} style={S.btn("#fb923c", true)} onClick={() => reject(false)}>✕ Reject</button>
                  <button disabled={busy} style={S.btn("#f87171")} onClick={() => reject(true)}>⛔ + suppress</button>
                </div>
                <div style={{ fontSize: 9, color: "#4b5563", marginTop: 8 }}>keys: A approve · R reject · E edit · J/K next/prev</div>
              </div>
            ) : (
              <div style={{ ...S.panel, padding: 40, textAlign: "center", color: "#6b7280", fontSize: 12 }}>Select a draft to review.</div>
            )}
          </div>
        )
      )}

      {/* ════════════════════════════════════════════════════════════════════
           APPROVED QUEUE VIEW
         ════════════════════════════════════════════════════════════════════ */}
      {view === "approved" && (
        approvedLoading ? (
          <div style={{ color: "#6b7280", fontSize: 12, padding: 40, textAlign: "center" }}>Loading approved queue…</div>
        ) : approvedDrafts.length === 0 ? (
          <div style={{ ...S.panel, padding: 40, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
            <div style={{ fontSize: 20, marginBottom: 10 }}>✓</div>
            No approved drafts waiting to be sent.
            <div style={{ marginTop: 8, fontSize: 11 }}>Approve targets from the Pending Review tab first.</div>
          </div>
        ) : (
          <div style={S.wrap}>
            {/* Approved list */}
            <div style={{ ...S.panel, overflow: "hidden", alignSelf: "start" }}>
              <div style={S.listHdr}>
                <span>APPROVED · newest first</span>
                <span style={{ color: "#a78bfa" }}>{approvedDrafts.length}</span>
              </div>
              <div style={{ maxHeight: 600, overflowY: "auto" }}>
                {approvedDrafts.map(d => {
                  const active = d.draft_id === approvedSelectedId;
                  const cc = CHANNEL_COLOR[d.channel] || "#9ca3af";
                  const warn = emailQualityWarning(d.contact_email);
                  return (
                    <div key={d.draft_id} style={S.rowApproved(active)} onClick={() => { setApprovedSelectedId(d.draft_id); setEditContact(d.contact_email || ""); }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontSize: 12, color: "#e6edf3", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.company_name || "—"}</div>
                        <span style={S.pill(cc)}>{d.channel}</span>
                      </div>
                      <div style={{ fontSize: 9, color: warn ? "#facc15" : "#4b5563", margin: "3px 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {warn ? "⚠ " : "✉ "}{d.contact_email || "(no email)"}
                      </div>
                      <div style={{ fontSize: 9, color: "#4b5563", display: "flex", justifyContent: "space-between" }}>
                        <span>{d.primary_domain || "—"}</span>
                        <span>approved {relTime(d.approved_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Approved detail */}
            {approvedSelected ? (
              <div style={{ ...S.panel, padding: 18, overflowY: "auto", maxHeight: "80vh" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 16, color: "#fff", fontWeight: "bold" }}>{approvedSelected.company_name || "—"}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      {approvedSelected.primary_domain || "—"}
                      {approvedSelected.vertical && <span> · {approvedSelected.vertical}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 10, color: "#6b7280" }}>
                    <div style={{ color: "#a78bfa", marginBottom: 2 }}>✓ Approved</div>
                    <div>{relTime(approvedSelected.approved_at)}</div>
                  </div>
                </div>

                {/* Contact email (editable even post-approval to fix before Cowork sends) */}
                <ContactEmailEditor draft={approvedSelected} />

                {/* Subject + Body preview */}
                <div style={{ marginBottom: 16 }}>
                  <div style={S.label}>Subject</div>
                  <div style={{ fontSize: 12, color: "#e6edf3", marginBottom: 10 }}>{approvedSelected.subject || <span style={{ color: "#6b7280" }}>(no subject)</span>}</div>
                  <div style={S.label}>Body {approvedSelected.edited_body ? <span style={{ color: "#facc15" }}>· edited</span> : null}</div>
                  <pre style={{ background: "#06090d", border: "1px solid #161b22", borderRadius: 6, padding: 12, fontSize: 11, color: "#c9d1d9", overflowX: "auto", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {approvedSelected.edited_body || approvedSelected.body}
                  </pre>
                  {approvedSelected.opt_out_line && (
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6, fontStyle: "italic" }}>{approvedSelected.opt_out_line}</div>
                  )}
                </div>

                <div style={{ fontSize: 11, color: "#6b7280", padding: "10px 12px", background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 6 }}>
                  📬 This draft will be created in <strong style={{ color: "#c9d1d9" }}>efinney@brandguardhq.com</strong> Gmail by the Cowork scheduled task (every 15 min), or click <strong style={{ color: "#c9d1d9" }}>Send Approved to Gmail</strong> to trigger immediately.
                </div>
              </div>
            ) : (
              <div style={{ ...S.panel, padding: 40, textAlign: "center", color: "#6b7280", fontSize: 12 }}>Select an approved draft to inspect.</div>
            )}
          </div>
        )
      )}
    </div>
  );
}
