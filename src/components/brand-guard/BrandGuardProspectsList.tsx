/**
 * BrandGuardProspectsList.tsx — Searchable prospects browser
 * ========================================================================
 * Displays all rows from the outreach DB `prospects` table.
 * Supports search (company / domain / contact email), filter by channel /
 * approval / suppressed / compliance, and sort by victim score or date.
 * Inline contact editing (email, name, title, LinkedIn) via PATCH /prospect.
 *
 * API: GET  /api/brand-guard/admin/prospects   (paginated + filtered)
 *      PATCH /api/brand-guard/admin/prospect   (update contact fields)
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Prospect {
  id: string;
  company_name: string | null;
  primary_domain: string | null;
  vertical: string | null;
  contact_email: string | null;
  contact_name: string | null;
  contact_title: string | null;
  linkedin_url: string | null;
  victim_score: number;
  compliance_ok: boolean;
  compliance_region: string | null;
  suppressed: boolean;
  channel: string | null;
  approval: string | null;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface EditState {
  prospectId: string;
  contact_email: string;
  contact_name: string;
  contact_title: string;
  linkedin_url: string;
  saving: boolean;
}

const API_BASE = "/api/brand-guard/admin";
const PAGE_SIZE = 50;

// ── helpers ───────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 70) return "#4ade80";
  if (s >= 50) return "#facc15";
  return "#f87171";
}

function approvalBadge(a: string | null) {
  if (a === "approved") return { bg: "rgba(74,222,128,0.1)", color: "#4ade80", label: "approved" };
  if (a === "rejected") return { bg: "rgba(248,113,113,0.1)", color: "#f87171", label: "rejected" };
  return { bg: "rgba(107,114,128,0.1)", color: "#6b7280", label: a || "unreviewed" };
}

function emailQualityWarn(email: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return (
    e.includes("abuse@") || e.includes("domainabuse@") || e.includes("abusecomplaints@") ||
    e.startsWith("webmaster@") || e.includes("@service.aliyun") || e.includes("@godaddy.com") ||
    e.includes("@nameshield") || e.includes("@key-systems") || e.includes("@web.com") ||
    e.includes("@safebrands")
  );
}

const REGION_AMBER = new Set(["EU", "UK", "EEA", "GB"]);

// ── component ─────────────────────────────────────────────────────────────────
export default function BrandGuardProspectsList({ authToken }: { authToken: string | null }) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [unavailableMsg, setUnavailableMsg] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [suppressedFilter, setSuppressedFilter] = useState("");
  const [sort, setSort] = useState("victim_score");
  const [offset, setOffset] = useState(0);

  // Edit state
  const [editState, setEditState] = useState<EditState | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async (overrideOffset = offset) => {
    if (!authToken) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(overrideOffset),
        sort,
        order: "desc",
      });
      if (search) params.set("search", search);
      if (channelFilter) params.set("channel", channelFilter);
      if (approvalFilter) params.set("approval", approvalFilter);
      if (suppressedFilter) params.set("suppressed", suppressedFilter);

      const res = await fetch(`${API_BASE}/prospects?${params}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.available === false) {
        setAvailable(false);
        setUnavailableMsg(data.message || "Tables not provisioned.");
      } else {
        setAvailable(true);
        setProspects(data.prospects || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load prospects");
    } finally {
      setLoading(false);
    }
  }, [authToken, search, channelFilter, approvalFilter, suppressedFilter, sort, offset]);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setOffset(0); load(0); }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]); // eslint-disable-line

  // Reload on filter/sort/page changes
  useEffect(() => { load(); }, [channelFilter, approvalFilter, suppressedFilter, sort, offset]); // eslint-disable-line

  // Initial load
  useEffect(() => { load(0); }, []); // eslint-disable-line

  // ── Save contact ───────────────────────────────────────────────────────────
  const saveContact = async () => {
    if (!editState || editState.saving) return;
    setEditState(e => e ? { ...e, saving: true } : null);
    try {
      const res = await fetch(`${API_BASE}/prospect`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          prospect_id: editState.prospectId,
          contact_email: editState.contact_email.trim(),
          contact_name: editState.contact_name.trim(),
          contact_title: editState.contact_title.trim(),
          linkedin_url: editState.linkedin_url.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      // Patch local state
      setProspects(prev => prev.map(p =>
        p.id === editState.prospectId
          ? { ...p, contact_email: editState.contact_email.trim() || null, contact_name: editState.contact_name.trim() || null, contact_title: editState.contact_title.trim() || null, linkedin_url: editState.linkedin_url.trim() || null }
          : p
      ));
      showToast("✓ Prospect updated");
      setEditState(null);
    } catch (e) {
      showToast(`⚠ ${e instanceof Error ? e.message : "Failed"}`);
      setEditState(e2 => e2 ? { ...e2, saving: false } : null);
    }
  };

  const startEdit = (p: Prospect) => {
    setEditState({
      prospectId: p.id,
      contact_email: p.contact_email || "",
      contact_name: p.contact_name || "",
      contact_title: p.contact_title || "",
      linkedin_url: p.linkedin_url || "",
      saving: false,
    });
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    panel: { background: "#0d1117", border: "1px solid #161b22", borderRadius: 8 },
    input: (accent = false) => ({
      background: "#161b22",
      border: `1px solid ${accent ? "rgba(74,222,128,0.35)" : "#21262d"}`,
      borderRadius: 6,
      padding: "8px 10px",
      fontSize: 12,
      color: "#c9d1d9",
      outline: "none",
      fontFamily: "'DM Mono',monospace",
    }),
    select: {
      background: "#161b22",
      border: "1px solid #21262d",
      borderRadius: 6,
      padding: "7px 10px",
      fontSize: 11,
      color: "#c9d1d9",
      outline: "none",
      fontFamily: "'DM Mono',monospace",
      cursor: "pointer",
    },
    btn: (color: string, ghost = false) => ({
      fontSize: 11,
      padding: "7px 14px",
      background: ghost ? "transparent" : `rgba(${hexToRgb(color)},0.1)`,
      border: `1px solid rgba(${hexToRgb(color)},${ghost ? 0.2 : 0.4})`,
      borderRadius: 6,
      color: ghost ? "#6b7280" : color,
      cursor: "pointer",
      fontFamily: "'DM Mono',monospace",
      display: "inline-flex" as const,
      alignItems: "center",
      gap: 5,
    }),
    btnSm: (color: string) => ({
      fontSize: 10,
      padding: "4px 9px",
      background: `rgba(${hexToRgb(color)},0.08)`,
      border: `1px solid rgba(${hexToRgb(color)},0.3)`,
      borderRadius: 4,
      color,
      cursor: "pointer",
      fontFamily: "'DM Mono',monospace",
    }),
  };

  if (!available) {
    return (
      <div style={{ ...S.panel, padding: 28, fontFamily: "'DM Mono',monospace" }}>
        <div style={{ fontSize: 13, color: "#facc15", marginBottom: 8 }}>⚠ Outreach tables not provisioned</div>
        <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>{unavailableMsg}</div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div style={{ fontFamily: "'DM Mono','Courier New',monospace", color: "#c9d1d9", position: "relative" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 99, background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", fontSize: 11, padding: "8px 14px", borderRadius: 6 }}>{toast}</div>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <input
          style={{ ...S.input(), flex: "1 1 200px", minWidth: 160 }}
          placeholder="Search company, domain, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={channelFilter} onChange={e => { setChannelFilter(e.target.value); setOffset(0); }} style={S.select}>
          <option value="">All channels</option>
          <option value="A">A — Email (verified)</option>
          <option value="B">B — Email (role)</option>
          <option value="C">C — LinkedIn</option>
          <option value="D">D — Form</option>
        </select>
        <select value={approvalFilter} onChange={e => { setApprovalFilter(e.target.value); setOffset(0); }} style={S.select}>
          <option value="">All statuses</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={suppressedFilter} onChange={e => { setSuppressedFilter(e.target.value); setOffset(0); }} style={S.select}>
          <option value="">All (incl. suppressed)</option>
          <option value="false">Active only</option>
          <option value="true">Suppressed only</option>
        </select>
        <select value={sort} onChange={e => { setSort(e.target.value); setOffset(0); }} style={S.select}>
          <option value="victim_score">Sort: score ↓</option>
          <option value="created_at">Sort: newest</option>
          <option value="updated_at">Sort: updated</option>
          <option value="company_name">Sort: name A–Z</option>
        </select>
        <button onClick={() => load()} style={S.btn("#60a5fa", true)} disabled={loading}>
          {loading ? "…" : "↻"}
        </button>
        <span style={{ fontSize: 10, color: "#4b5563", marginLeft: 4 }}>
          {total.toLocaleString()} total
        </span>
      </div>

      {error && (
        <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#f87171", marginBottom: 12 }}>{error}</div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div style={{ ...S.panel, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.6fr 1.8fr 56px 80px 72px 72px 80px", gap: 0, padding: "7px 14px", borderBottom: "1px solid #161b22", fontSize: 9, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1 }}>
          <span>Company / Domain</span>
          <span>Contact</span>
          <span>Email</span>
          <span>Score</span>
          <span>Channel</span>
          <span>Status</span>
          <span>Region</span>
          <span></span>
        </div>

        {loading && prospects.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#4b5563", fontSize: 12 }}>Loading…</div>
        )}

        {!loading && prospects.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#4b5563", fontSize: 12 }}>No prospects match the current filters.</div>
        )}

        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          {prospects.map(p => {
            const badge = approvalBadge(p.approval);
            const warn = emailQualityWarn(p.contact_email);
            const region = (p.compliance_region || "").toUpperCase();
            const isExpanded = expandedId === p.id;
            const isEditing = editState?.prospectId === p.id;

            return (
              <div key={p.id} style={{ borderBottom: "1px solid #0d1117" }}>
                {/* Main row */}
                <div
                  style={{ display: "grid", gridTemplateColumns: "2fr 1.6fr 1.8fr 56px 80px 72px 72px 80px", gap: 0, padding: "9px 14px", fontSize: 11, cursor: "pointer", background: isExpanded ? "rgba(74,222,128,0.03)" : "transparent", alignItems: "center" }}
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                >
                  {/* Company */}
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ color: "#e6edf3", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.suppressed && <span style={{ color: "#f87171", marginRight: 4 }}>⛔</span>}
                      {p.company_name || "—"}
                    </div>
                    <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2 }}>{p.primary_domain || "—"}</div>
                  </div>

                  {/* Contact name */}
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ color: "#8b949e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.contact_name || <span style={{ color: "#4b5563" }}>—</span>}</div>
                    {p.contact_title && <div style={{ fontSize: 9, color: "#4b5563" }}>{p.contact_title}</div>}
                  </div>

                  {/* Email */}
                  <div style={{ overflow: "hidden" }}>
                    {p.contact_email ? (
                      <div style={{ color: warn ? "#facc15" : "#60a5fa", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {warn && <span>⚠ </span>}{p.contact_email}
                      </div>
                    ) : (
                      <span style={{ color: "#f87171", fontSize: 10 }}>MISSING</span>
                    )}
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: "center" }}>
                    <span style={{ color: scoreColor(p.victim_score), fontWeight: "bold" }}>{p.victim_score}</span>
                  </div>

                  {/* Channel */}
                  <div style={{ fontSize: 9, color: "#6b7280" }}>{p.channel || "—"}</div>

                  {/* Approval */}
                  <div>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  </div>

                  {/* Region */}
                  <div style={{ fontSize: 9, color: REGION_AMBER.has(region) ? "#facc15" : "#4b5563" }}>
                    {REGION_AMBER.has(region) && "⚠ "}{region || "—"}
                  </div>

                  {/* Edit button */}
                  <div onClick={e => e.stopPropagation()}>
                    <button
                      style={S.btnSm("#a78bfa")}
                      onClick={() => { setExpandedId(p.id); startEdit(p); }}
                    >
                      ✎ Edit
                    </button>
                  </div>
                </div>

                {/* Expanded / edit panel */}
                {isExpanded && (
                  <div style={{ padding: "12px 14px 16px", background: "rgba(167,139,250,0.03)", borderTop: "1px solid #161b22" }}>
                    {isEditing ? (
                      /* ── Edit form ── */
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 720 }}>
                        <div>
                          <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Contact Email {warn && <span style={{ color: "#facc15" }}>· registrar address</span>}</div>
                          <input
                            style={{ ...S.input(warn), width: "100%" }}
                            value={editState!.contact_email}
                            onChange={e => setEditState(s => s ? { ...s, contact_email: e.target.value } : null)}
                            placeholder="contact@company.com"
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Contact Name</div>
                          <input
                            style={{ ...S.input(), width: "100%" }}
                            value={editState!.contact_name}
                            onChange={e => setEditState(s => s ? { ...s, contact_name: e.target.value } : null)}
                            placeholder="Jane Smith"
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Title</div>
                          <input
                            style={{ ...S.input(), width: "100%" }}
                            value={editState!.contact_title}
                            onChange={e => setEditState(s => s ? { ...s, contact_title: e.target.value } : null)}
                            placeholder="Head of Brand"
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>LinkedIn URL</div>
                          <input
                            style={{ ...S.input(), width: "100%" }}
                            value={editState!.linkedin_url}
                            onChange={e => setEditState(s => s ? { ...s, linkedin_url: e.target.value } : null)}
                            placeholder="https://linkedin.com/in/…"
                          />
                        </div>
                        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 4 }}>
                          <button onClick={saveContact} disabled={editState!.saving} style={editState!.saving ? { ...S.btn("#4ade80"), opacity: 0.5, cursor: "not-allowed" } : S.btn("#4ade80")}>
                            {editState!.saving ? "Saving…" : "✓ Save changes"}
                          </button>
                          <button onClick={() => setEditState(null)} style={S.btn("#6b7280", true)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      /* ── Read-only expanded detail ── */
                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 11, color: "#8b949e" }}>
                        {p.contact_email && <span>✉ {p.contact_email}</span>}
                        {p.contact_name && <span>👤 {p.contact_name}{p.contact_title && ` · ${p.contact_title}`}</span>}
                        {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>LinkedIn ↗</a>}
                        {!p.compliance_ok && <span style={{ color: "#f87171" }}>⛔ compliance_ok=false</span>}
                        {p.sent_at && <span style={{ color: "#4ade80" }}>✉ sent {new Date(p.sent_at).toLocaleDateString()}</span>}
                        <button onClick={() => startEdit(p)} style={{ ...S.btnSm("#a78bfa"), marginLeft: "auto" }}>✎ Edit contact</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 11, color: "#6b7280" }}>
          <button disabled={offset === 0} onClick={() => { const o = Math.max(0, offset - PAGE_SIZE); setOffset(o); }} style={offset === 0 ? { ...S.btn("#6b7280", true), opacity: 0.3, cursor: "not-allowed" } : S.btn("#6b7280", true)}>← Prev</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button disabled={offset + PAGE_SIZE >= total} onClick={() => { const o = offset + PAGE_SIZE; setOffset(o); }} style={offset + PAGE_SIZE >= total ? { ...S.btn("#6b7280", true), opacity: 0.3, cursor: "not-allowed" } : S.btn("#6b7280", true)}>Next →</button>
        </div>
      )}
    </div>
  );
}

// hex to "r,g,b" string for rgba()
function hexToRgb(hex: string): string {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return "107,114,128";
  return m.map(h => parseInt(h, 16)).join(",");
}
