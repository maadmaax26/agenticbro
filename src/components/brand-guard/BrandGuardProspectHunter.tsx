/**
 * BrandGuardProspectHunter.tsx — Prospect Hunter + Outreach CRM
 * ========================================================================
 * Finds companies experiencing brand impersonation, generates AI research
 * briefs and cold outreach emails. Uses server-side AI endpoints to keep
 * the Anthropic API key secure.
 *
 * All AI calls go through /api/brand-guard/prospect-hunter
 * (action: hunt | email | research)
 */

import { useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface HuntResult {
  company: string;
  website: string;
  email: string;
  linkedin: string;
  instagram: string;
  vertical: string;
  riskLevel: "critical" | "high" | "medium";
  threatType: string;
  incidentSummary: string;
  source: string;
  urgency: string;
  contactRole: string;
  priorityChannel: string;
}

interface Prospect extends HuntResult {
  id: number;
  outreachStatus: "pending" | "contacted" | "replied" | "converted" | "not_interested";
  scanSummary: string;
  notes: string;
  generatedEmail: string;
  aiResearch: string;
}

// ── Search verticals ──────────────────────────────────────────────────────────
const VERTICALS = [
  { id: "shopify",    label: "Shopify / Ecommerce",    icon: "🛍️",  color: "#4ade80" },
  { id: "etsy",       label: "Etsy / Handmade",        icon: "🎨",  color: "#fb923c" },
  { id: "web3",       label: "Web3 / Crypto",          icon: "⛓️",  color: "#a78bfa" },
  { id: "saas",       label: "SaaS / Software",        icon: "💻",  color: "#60a5fa" },
  { id: "fashion",    label: "Fashion / Apparel",      icon: "👗",  color: "#f472b6" },
  { id: "finance",    label: "Finance / Fintech",      icon: "💳",  color: "#34d399" },
  { id: "health",     label: "Health / Wellness",      icon: "🏥",  color: "#fbbf24" },
  { id: "food",       label: "Food / Restaurant",       icon: "🍽️",  color: "#f87171" },
  { id: "legal",      label: "Legal / Accounting",     icon: "⚖️",  color: "#c084fc" },
  { id: "realestate", label: "Real Estate",            icon: "🏠",  color: "#38bdf8" },
];

const RISK_STYLE: Record<string, { dot: string; text: string; border: string; bg: string }> = {
  critical: { dot:"#f87171", text:"#f87171", border:"rgba(248,113,113,0.4)", bg:"rgba(248,113,113,0.08)" },
  high:     { dot:"#fb923c", text:"#fb923c", border:"rgba(251,146,60,0.4)",  bg:"rgba(251,146,60,0.08)"  },
  medium:   { dot:"#facc15", text:"#facc15", border:"rgba(250,204,21,0.4)",  bg:"rgba(250,204,21,0.08)"  },
  low:      { dot:"#60a5fa", text:"#60a5fa", border:"rgba(96,165,250,0.4)",  bg:"rgba(96,165,250,0.08)"  },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:        { bg:"rgba(107,114,128,0.2)", color:"#9ca3af" },
  contacted:      { bg:"rgba(96,165,250,0.15)", color:"#60a5fa" },
  replied:        { bg:"rgba(250,204,21,0.15)", color:"#facc15" },
  converted:      { bg:"rgba(74,222,128,0.15)", color:"#4ade80" },
  not_interested: { bg:"rgba(248,113,113,0.15)", color:"#f87171" },
};

const THREAT_COLORS: Record<string, string> = {
  "Cloned Store":           "#fb923c",
  "Fake Social Accounts":   "#f472b6",
  "Lookalike Domain":       "#facc15",
  "Email Spoofing":         "#60a5fa",
  "Vendor Fraud":           "#f87171",
  "Telegram Impersonation": "#a78bfa",
};

const API_URL = "/api/brand-guard/prospect-hunter";

// ── API helpers ─────────────────────────────────────────────────────────────────

async function apiCall(action: string, payload: Record<string, unknown>, authToken: string): Promise<unknown> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BrandGuardProspectHunter({ authToken }: { authToken: string }) {
  const [screen, setScreen] = useState<"hunt" | "crm">("hunt");
  const [selectedVertical, setSelectedVertical] = useState<{ id: string; label: string } | null>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [hunting, setHunting] = useState(false);
  const [huntResults, setHuntResults] = useState<HuntResult[]>([]);
  const [huntError, setHuntError] = useState("");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [crmTab, setCrmTab] = useState<"overview" | "research" | "email">("overview");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [generatingResearch, setGeneratingResearch] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const selected = prospects.find(p => p.id === selectedId) as Prospect | undefined;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function updateProspect(id: number, patch: Partial<Prospect>) {
    setProspects(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  // ── HUNT: search for impersonation victims ──────────────────────────────────
  const runHunt = useCallback(async () => {
    const query = customQuery.trim() || (selectedVertical ? `${selectedVertical.label} businesses` : "");
    if (!query && !selectedVertical) return;
    setHunting(true);
    setHuntResults([]);
    setHuntError("");

    try {
      const data = await apiCall("hunt", {
        vertical: selectedVertical?.label,
        query,
      }, authToken) as { results: HuntResult[] };

      setHuntResults(data.results.map((r, i) => ({ ...r, _idx: i })));
    } catch (e: any) {
      setHuntError(e.message || "Search failed");
    }
    setHunting(false);
  }, [authToken, customQuery, selectedVertical]);

  // ── Add to CRM ──────────────────────────────────────────────────────────────
  function addToCRM(result: HuntResult) {
    const already = prospects.find(p => p.website === result.website);
    if (already) {
      showToast(`${result.company} already in CRM`);
      setScreen("crm");
      setSelectedId(already.id);
      return;
    }
    const newP: Prospect = {
      ...result,
      id: Date.now() + Math.random(),
      outreachStatus: "pending",
      scanSummary: result.incidentSummary,
      notes: `Source: ${result.source}. Contact: ${result.contactRole}. Urgency: ${result.urgency}`,
      generatedEmail: "",
      aiResearch: "",
    };
    setProspects(prev => [newP, ...prev]);
    setSelectedId(newP.id);
    setCrmTab("overview");
    setScreen("crm");
    showToast(`Added ${result.company} to CRM`);
  }

  function addAllToCRM() {
    let added = 0;
    const newOnes: Prospect[] = [];
    huntResults.forEach(r => {
      if (!prospects.find(p => p.website === r.website)) {
        newOnes.push({
          ...r,
          id: Date.now() + Math.random(),
          outreachStatus: "pending",
          scanSummary: r.incidentSummary,
          notes: `Source: ${r.source}. Contact: ${r.contactRole}. Urgency: ${r.urgency}`,
          generatedEmail: "",
          aiResearch: "",
        });
        added++;
      }
    });
    if (added > 0) {
      setProspects(prev => [...newOnes, ...prev]);
      showToast(`Added ${added} companies to CRM`);
    } else {
      showToast("All companies already in CRM");
    }
  }

  // ── Generate email ──────────────────────────────────────────────────────────
  const generateEmail = useCallback(async () => {
    if (!selected || generatingEmail) return;
    setGeneratingEmail(true);
    try {
      const data = await apiCall("email", {
        company: selected.company,
        website: selected.website,
        email: selected.email,
        contactRole: selected.contactRole,
        vertical: selected.vertical,
        scanSummary: selected.scanSummary,
        threatType: selected.threatType,
        urgency: selected.urgency,
        source: selected.source,
        aiResearch: selected.aiResearch,
      }, authToken) as { email: string };

      updateProspect(selected.id, { generatedEmail: data.email });
      showToast("Email ready");
    } catch {
      showToast("Email generation failed");
    }
    setGeneratingEmail(false);
  }, [authToken, selected, generatingEmail]);

  // ── Generate research ───────────────────────────────────────────────────────
  const generateResearch = useCallback(async () => {
    if (!selected || generatingResearch) return;
    setGeneratingResearch(true);
    try {
      const data = await apiCall("research", {
        company: selected.company,
        website: selected.website,
        vertical: selected.vertical,
        scanSummary: selected.scanSummary,
        threatType: selected.threatType,
      }, authToken) as { research: string };

      updateProspect(selected.id, { aiResearch: data.research });
      showToast("Research complete");
    } catch {
      showToast("Research failed");
    }
    setGeneratingResearch(false);
  }, [authToken, selected, generatingResearch]);

  function copyEmail(p: Prospect) {
    navigator.clipboard.writeText(p.generatedEmail);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function exportCSV() {
    const h = ["Company","Website","Email","LinkedIn","Instagram","Vertical","Threat Type","Risk","Status","Incident Summary","Source","Notes"];
    const rows = prospects.map(r =>
      [r.company,r.website,r.email,r.linkedin,r.instagram,r.vertical,r.threatType,r.riskLevel,r.outreachStatus,r.scanSummary,r.source||"",r.notes]
      .map(v => `"${String(v||"").replace(/"/g,'""')}"`).join(",")
    );
    const csv = [h.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type:"text/csv" }));
    a.download = "brand-guard-prospects.csv";
    a.click();
  }

  const filteredProspects = prospects.filter(p =>
    filterStatus === "all" || p.outreachStatus === filterStatus
  );

  const stats = {
    total: prospects.length,
    critical: prospects.filter(p => p.riskLevel === "critical").length,
    pending: prospects.filter(p => p.outreachStatus === "pending").length,
    contacted: prospects.filter(p => ["contacted","replied"].includes(p.outreachStatus)).length,
    converted: prospects.filter(p => p.outreachStatus === "converted").length,
  };

  // ─── STYLES ─────────────────────────────────────────────────────────────────
  const S = {
    app: { fontFamily:"'DM Mono','Courier New',monospace", background:"#06090d", minHeight:"100vh", color:"#c9d1d9" },
    header: { borderBottom:"1px solid #161b22", background:"#06090d", position:"sticky" as const, top:0, zIndex:30, padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" },
    nav: { display:"flex", gap:2, background:"#0d1117", border:"1px solid #161b22", borderRadius:6, padding:3 },
    navBtn: (active: boolean) => ({ fontSize:11, padding:"5px 14px", borderRadius:4, border:"none", cursor:"pointer", fontFamily:"'DM Mono',monospace", background: active ? "rgba(74,222,128,0.12)" : "transparent", color: active ? "#4ade80" : "#6b7280" }),
    panel: { background:"#0d1117", border:"1px solid #161b22", borderRadius:8 },
    input: { background:"#161b22", border:"1px solid #21262d", borderRadius:6, padding:"9px 12px", fontSize:12, color:"#c9d1d9", outline:"none", fontFamily:"'DM Mono',monospace", width:"100%", boxSizing:"border-box" as const },
    btn: (color="#4ade80", ghost=false) => ({ fontSize:11, padding:"8px 18px", background: ghost ? "transparent" : `rgba(${color === "#4ade80" ? "74,222,128" : color === "#a78bfa" ? "167,139,250" : color === "#60a5fa" ? "96,165,250" : "251,146,60"},0.1)`, border:`1px solid rgba(${color === "#4ade80" ? "74,222,128" : color === "#a78bfa" ? "167,139,250" : color === "#60a5fa" ? "96,165,250" : "251,146,60"},${ghost?0.2:0.4})`, borderRadius:6, color: ghost ? "#6b7280" : color, cursor:"pointer", fontFamily:"'DM Mono',monospace", display:"inline-flex" as const, alignItems:"center" as const, gap:6 }),
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:3px; height:3px; }
        ::-webkit-scrollbar-track { background:#06090d; }
        ::-webkit-scrollbar-thumb { background:#21262d; border-radius:2px; }
        select option { background:#0d1117; }
        .hover-row:hover { background:rgba(74,222,128,0.03) !important; }
        .hover-card:hover { border-color:rgba(74,222,128,0.25) !important; background:rgba(74,222,128,0.02) !important; }
        .pulse { animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .slide-in { animation: slideIn 0.2s ease; }
        @keyframes slideIn { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{position:"fixed",top:16,right:16,zIndex:99,background:"rgba(74,222,128,0.15)",border:"1px solid rgba(74,222,128,0.4)",color:"#4ade80",fontSize:11,padding:"8px 14px",borderRadius:6}}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:28,height:28,background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.25)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:"bold",color:"#4ade80",fontFamily:"'Syne',sans-serif"}}>A</div>
          <div>
            <div style={{fontSize:13,fontWeight:"bold",color:"#fff",fontFamily:"'Syne',sans-serif",letterSpacing:2}}>BRAND GUARD</div>
            <div style={{fontSize:9,color:"#484f58",letterSpacing:1}}>PROSPECT HUNTER · OUTREACH CRM</div>
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {screen === "crm" && prospects.length > 0 && (
            <div style={{display:"flex",gap:16,fontSize:10,color:"#6b7280"}}>
              <span>{stats.total} total</span>
              <span style={{color:"#f87171"}}>{stats.critical} critical</span>
              <span style={{color:"#60a5fa"}}>{stats.contacted} contacted</span>
              <span style={{color:"#4ade80"}}>{stats.converted} converted</span>
            </div>
          )}
          <div style={S.nav}>
            <button style={S.navBtn(screen==="hunt")} onClick={()=>setScreen("hunt")}>🔍 Hunt</button>
            <button style={S.navBtn(screen==="crm")} onClick={()=>setScreen("crm")}>
              📋 CRM {prospects.length > 0 && <span style={{fontSize:9,background:"rgba(74,222,128,0.2)",color:"#4ade80",padding:"1px 5px",borderRadius:3,marginLeft:2}}>{prospects.length}</span>}
            </button>
          </div>
          {screen==="crm" && prospects.length>0 && (
            <button onClick={exportCSV} style={{...S.btn("#6b7280",true),padding:"6px 10px"}}>↓ CSV</button>
          )}
        </div>
      </div>

      {/* ─── HUNT SCREEN ──────────────────────────────────────────────── */}
      {screen === "hunt" && (
        <div style={{maxWidth:900,margin:"0 auto",padding:"28px 20px"}}>

          {/* Hero */}
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:22,fontWeight:"bold",color:"#fff",fontFamily:"'Syne',sans-serif",marginBottom:8}}>
              Find Companies Being Impersonated Right Now
            </div>
            <div style={{fontSize:12,color:"#6b7280",maxWidth:520,margin:"0 auto"}}>
              AI searches for real businesses with recent brand impersonation incidents — fake stores, lookalike domains, fake social accounts — then generates personalised outreach.
            </div>
          </div>

          {/* Vertical picker */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,color:"#6b7280",marginBottom:10,letterSpacing:1}}>SEARCH BY VERTICAL</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
              {VERTICALS.map(v => (
                <button key={v.id} onClick={()=>setSelectedVertical(selectedVertical?.id===v.id?null:v)}
                  style={{padding:"10px 8px",background:selectedVertical?.id===v.id?`rgba(74,222,128,0.08)`:"#0d1117",border:`1px solid ${selectedVertical?.id===v.id?"rgba(74,222,128,0.4)":"#161b22"}`,borderRadius:7,cursor:"pointer",textAlign:"center",transition:"all 0.15s",fontFamily:"'DM Mono',monospace"}}>
                  <div style={{fontSize:18,marginBottom:4}}>{v.icon}</div>
                  <div style={{fontSize:9,color:selectedVertical?.id===v.id?"#4ade80":"#6b7280",lineHeight:1.3}}>{v.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom query */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,color:"#6b7280",marginBottom:8,letterSpacing:1}}>OR DESCRIBE WHAT YOU&apos;RE LOOKING FOR</div>
            <div style={{display:"flex",gap:8}}>
              <input value={customQuery} onChange={e=>setCustomQuery(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&!hunting&&runHunt()}
                placeholder='e.g. "UK fashion brands with fake Instagram accounts" or "crypto projects with fake Telegram groups"'
                style={S.input}/>
              <button onClick={runHunt} disabled={hunting||(!selectedVertical&&!customQuery.trim())}
                style={{...S.btn("#4ade80"),flexShrink:0,padding:"9px 20px",opacity:hunting||(!selectedVertical&&!customQuery.trim())?0.4:1,cursor:hunting||(!selectedVertical&&!customQuery.trim())?"not-allowed":"pointer"}}>
                {hunting ? <><span className="pulse">⟳</span> Hunting...</> : "Hunt →"}
              </button>
            </div>
          </div>

          {/* Error */}
          {huntError && (
            <div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:6,padding:"10px 14px",fontSize:11,color:"#f87171",marginBottom:16}}>
              {huntError}
            </div>
          )}

          {/* Loading */}
          {hunting && (
            <div style={{...S.panel,padding:32,textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:10}} className="pulse">🔍</div>
              <div style={{fontSize:12,color:"#6b7280",marginBottom:4}}>Searching for impersonation victims...</div>
              <div style={{fontSize:10,color:"#484f58"}}>Scanning forums, news, social media, and community reports</div>
            </div>
          )}

          {/* Results */}
          {huntResults.length > 0 && !hunting && (
            <div className="slide-in">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{fontSize:11,color:"#6b7280"}}>{huntResults.length} companies found with active brand impersonation issues</div>
                <button onClick={addAllToCRM} style={S.btn("#4ade80")}>
                  + Add All to CRM
                </button>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {huntResults.map((r, i) => {
                  const rs = RISK_STYLE[r.riskLevel] || RISK_STYLE.medium;
                  const tc = THREAT_COLORS[r.threatType] || "#9ca3af";
                  const inCRM = prospects.find(p => p.website === r.website);
                  return (
                    <div key={i} className="hover-card"
                      style={{...S.panel,padding:"16px 18px",cursor:"pointer",transition:"all 0.15s",borderColor:"#161b22"}}
                      onClick={()=>!inCRM&&addToCRM(r)}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:13,fontWeight:"bold",color:"#fff"}}>{r.company}</span>
                            <span style={{fontSize:10,color:"#60a5fa"}}>{r.website}</span>
                            <span style={{fontSize:9,padding:"2px 7px",borderRadius:3,background:`rgba(${tc.replace("#","").match(/.{2}/g)!.map(h=>parseInt(h,16)).join(",")},0.12)`,color:tc,border:`1px solid rgba(${tc.replace("#","").match(/.{2}/g)!.map(h=>parseInt(h,16)).join(",")},0.3)`}}>
                              {r.threatType}
                            </span>
                            <span style={{fontSize:9,padding:"2px 7px",borderRadius:3,background:rs.bg,color:rs.text,border:`1px solid ${rs.border}`}}>
                              <span style={{display:"inline-block",width:5,height:5,borderRadius:"50%",background:rs.dot,marginRight:4}}></span>
                              {r.riskLevel}
                            </span>
                          </div>
                          <div style={{fontSize:11,color:"#8b949e",lineHeight:1.6,marginBottom:8}}>{r.incidentSummary}</div>
                          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                            <span style={{fontSize:10,color:"#484f58"}}>📍 {r.vertical}</span>
                            {r.source && <span style={{fontSize:10,color:"#484f58"}}>📰 {r.source}</span>}
                            {r.contactRole && <span style={{fontSize:10,color:"#484f58"}}>👤 Contact: {r.contactRole}</span>}
                          </div>
                          {r.urgency && (
                            <div style={{marginTop:8,fontSize:10,color:"#facc15",background:"rgba(250,204,21,0.06)",border:"1px solid rgba(250,204,21,0.15)",borderRadius:4,padding:"4px 8px",display:"inline-block"}}>
                              ⚡ {r.urgency}
                            </div>
                          )}
                        </div>
                        <div style={{flexShrink:0}}>
                          {inCRM ? (
                            <button onClick={e=>{e.stopPropagation();setScreen("crm");setSelectedId(inCRM.id);}}
                              style={{...S.btn("#4ade80",true),fontSize:10,padding:"5px 10px"}}>
                              ✓ In CRM →
                            </button>
                          ) : (
                            <button onClick={e=>{e.stopPropagation();addToCRM(r);}}
                              style={{...S.btn("#4ade80"),fontSize:10,padding:"6px 12px"}}>
                              + Add to CRM
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {huntResults.length === 0 && !hunting && !huntError && (
            <div style={{...S.panel,padding:48,textAlign:"center",borderStyle:"dashed"}}>
              <div style={{fontSize:36,marginBottom:12}}>🎯</div>
              <div style={{fontSize:13,color:"#6b7280",marginBottom:6}}>Select a vertical or enter a search query</div>
              <div style={{fontSize:11,color:"#484f58"}}>AI will find real companies with documented brand impersonation incidents</div>
            </div>
          )}
        </div>
      )}

      {/* ─── CRM SCREEN ───────────────────────────────────────────────── */}
      {screen === "crm" && (
        <div style={{display:"flex",height:"calc(100vh - 57px)"}}>

          {/* Sidebar */}
          <div style={{width:260,borderRight:"1px solid #161b22",display:"flex",flexDirection:"column",flexShrink:0}}>
            <div style={{padding:"10px 10px 8px",borderBottom:"1px solid #0d1117"}}>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                style={{...S.input,fontSize:10,padding:"5px 8px"}}>
                <option value="all">All Prospects ({prospects.length})</option>
                <option value="pending">Pending ({stats.pending})</option>
                <option value="contacted">Contacted ({stats.contacted})</option>
                <option value="converted">Converted ({stats.converted})</option>
              </select>
            </div>

            {prospects.length === 0 ? (
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,padding:20,textAlign:"center"}}>
                <div style={{fontSize:24}}>🎯</div>
                <div style={{fontSize:11,color:"#6b7280"}}>No prospects yet</div>
                <button onClick={()=>setScreen("hunt")} style={{...S.btn("#4ade80"),fontSize:10,marginTop:4}}>
                  Hunt for prospects →
                </button>
              </div>
            ) : (
              <div style={{flex:1,overflowY:"auto"}}>
                {filteredProspects.map((p) => {
                  const rs = RISK_STYLE[p.riskLevel] || RISK_STYLE.medium;
                  const isSel = p.id === selectedId;
                  const tc = THREAT_COLORS[p.threatType] || "#9ca3af";
                  return (
                    <div key={p.id} className="hover-row" onClick={()=>{setSelectedId(p.id);setCrmTab("overview");}}
                      style={{padding:"10px 12px",borderBottom:"1px solid #0d1117",cursor:"pointer",borderLeft:`2px solid ${isSel?"#4ade80":"transparent"}`,background:isSel?"rgba(74,222,128,0.04)":"transparent"}}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:6,marginBottom:4}}>
                        <span style={{fontSize:11,color:"#e6edf3",fontWeight:"500",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.company}</span>
                        <span style={{fontSize:8,padding:"2px 5px",borderRadius:3,background:rs.bg,color:rs.text,flexShrink:0}}>{p.riskLevel}</span>
                      </div>
                      <div style={{fontSize:9,color:tc,marginBottom:3}}>{p.threatType}</div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,...STATUS_STYLE[p.outreachStatus]}}>{p.outreachStatus.replace("_"," ")}</span>
                        <div style={{display:"flex",gap:3}}>
                          {p.generatedEmail && <span style={{fontSize:9,color:"#a78bfa"}} title="Email ready">✉</span>}
                          {p.aiResearch && <span style={{fontSize:9,color:"#4ade80"}} title="Research done">✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail */}
          {selected ? (
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}} key={selected.id}>
              {/* Company header */}
              <div style={{padding:"14px 20px",borderBottom:"1px solid #161b22",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                <div>
                  <div style={{fontSize:15,fontWeight:"bold",color:"#fff",fontFamily:"'Syne',sans-serif",marginBottom:6}}>{selected.company}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{fontSize:10,padding:"2px 7px",borderRadius:3,background:"rgba(255,255,255,0.05)",color:"#8b949e"}}>{selected.vertical}</span>
                    {selected.threatType && (
                      <span style={{fontSize:10,padding:"2px 7px",borderRadius:3,background:`rgba(${(THREAT_COLORS[selected.threatType]||"#9ca3af").replace("#","").match(/.{2}/g)!.map(h=>parseInt(h,16)).join(",")},0.1)`,color:THREAT_COLORS[selected.threatType]||"#9ca3af"}}>
                        {selected.threatType}
                      </span>
                    )}
                    <select value={selected.outreachStatus} onChange={e=>updateProspect(selected.id,{outreachStatus:e.target.value as Prospect["outreachStatus"]})}
                      style={{fontSize:10,background:"rgba(0,0,0,0.3)",border:"1px solid #21262d",borderRadius:4,color:"#8b949e",outline:"none",padding:"2px 6px",cursor:"pointer",fontFamily:"inherit"}}>
                      {["pending","contacted","replied","converted","not_interested"].map(v=><option key={v} value={v}>{v.replace("_"," ")}</option>)}
                    </select>
                  </div>
                </div>
                {/* Tabs */}
                <div style={{display:"flex",gap:2,background:"#0d1117",border:"1px solid #161b22",borderRadius:6,padding:3,flexShrink:0}}>
                  {[{id:"overview" as const,l:"Overview"},{id:"research" as const,l:"Research"},{id:"email" as const,l:"Email"}].map(t=>(
                    <button key={t.id} onClick={()=>setCrmTab(t.id)}
                      style={{fontSize:10,padding:"5px 12px",borderRadius:4,border:"none",cursor:"pointer",background:crmTab===t.id?"rgba(74,222,128,0.12)":"transparent",color:crmTab===t.id?"#4ade80":"#6b7280",fontFamily:"inherit"}}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{flex:1,overflowY:"auto",padding:20}} className="slide-in">
                <div style={{maxWidth:640}}>

                  {/* OVERVIEW */}
                  {crmTab === "overview" && (
                    <>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                        {[
                          {l:"Website",v:selected.website,href:`https://${selected.website}`},
                          {l:"Contact Email",v:selected.email,href:`mailto:${selected.email}`},
                          {l:"LinkedIn",v:selected.linkedin,href:selected.linkedin?`https://${selected.linkedin}`:""},
                          {l:"Instagram",v:selected.instagram,href:selected.instagram?`https://instagram.com/${selected.instagram.replace("@","")}`:""},
                          {l:"Contact Role",v:selected.contactRole||"—"},
                          {l:"Priority Channel",v:selected.priorityChannel||"—"},
                        ].map(({l,v,href})=>(
                          <div key={l} style={{background:"#0d1117",border:"1px solid #161b22",borderRadius:6,padding:"10px 12px"}}>
                            <div style={{fontSize:9,color:"#484f58",marginBottom:3}}>{l}</div>
                            {href&&v&&v!=="—"?(
                              <a href={href} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#60a5fa",textDecoration:"none",wordBreak:"break-all"}}>{v}</a>
                            ):(
                              <div style={{fontSize:11,color:"#8b949e"}}>{v||"—"}</div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:10,color:"#484f58",marginBottom:6}}>Incident Summary</div>
                        <div style={{background:"#0d1117",border:"1px solid #161b22",borderRadius:6,padding:"12px 14px",fontSize:11,color:"#8b949e",lineHeight:1.7}}>
                          {selected.scanSummary}
                        </div>
                      </div>

                      {selected.source && (
                        <div style={{marginBottom:12}}>
                          <div style={{fontSize:10,color:"#484f58",marginBottom:4}}>Source</div>
                          <div style={{fontSize:11,color:"#60a5fa"}}>{selected.source}</div>
                        </div>
                      )}

                      {selected.urgency && (
                        <div style={{marginBottom:16,background:"rgba(250,204,21,0.05)",border:"1px solid rgba(250,204,21,0.2)",borderRadius:6,padding:"8px 12px",fontSize:11,color:"#facc15"}}>
                          ⚡ {selected.urgency}
                        </div>
                      )}

                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setCrmTab("research")} style={S.btn("#4ade80")}>
                          {selected.aiResearch?"✓ View Research":"🔍 Run Research"}
                        </button>
                        <button onClick={()=>setCrmTab("email")} style={S.btn("#a78bfa")}>
                          {selected.generatedEmail?"✓ View Email":"✉️ Generate Email"}
                        </button>
                      </div>
                    </>
                  )}

                  {/* RESEARCH */}
                  {crmTab === "research" && (
                    <>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                        <div style={{fontSize:12,fontWeight:"bold",color:"#fff",fontFamily:"'Syne',sans-serif"}}>Threat Intelligence Brief</div>
                        <button onClick={generateResearch} disabled={generatingResearch}
                          style={{...S.btn("#4ade80"),opacity:generatingResearch?0.5:1,cursor:generatingResearch?"not-allowed":"pointer"}}>
                          {generatingResearch?<><span className="pulse">⟳</span>Researching...</>:selected.aiResearch?"↻ Refresh":"Run Research"}
                        </button>
                      </div>

                      {!selected.aiResearch && !generatingResearch && (
                        <div style={{...S.panel,padding:32,textAlign:"center",borderStyle:"dashed"}}>
                          <div style={{fontSize:24,marginBottom:8}}>🔍</div>
                          <div style={{fontSize:11,color:"#6b7280"}}>Generate a threat intelligence brief for personalised outreach</div>
                        </div>
                      )}

                      {generatingResearch && (
                        <div style={{...S.panel,padding:24,textAlign:"center"}}>
                          <div className="pulse" style={{fontSize:20,marginBottom:8}}>⟳</div>
                          <div style={{fontSize:11,color:"#6b7280"}}>Researching {selected.company}...</div>
                        </div>
                      )}

                      {selected.aiResearch && !generatingResearch && (
                        <>
                          <div style={{background:"#0d1117",border:"1px solid #161b22",borderRadius:8,padding:16,marginBottom:12}}>
                            <pre style={{fontSize:11,color:"#c9d1d9",whiteSpace:"pre-wrap",lineHeight:1.8,margin:0,fontFamily:"inherit"}}>
                              {selected.aiResearch}
                            </pre>
                          </div>
                          <button onClick={()=>setCrmTab("email")} style={S.btn("#a78bfa")}>
                            Generate Email →
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {/* EMAIL */}
                  {crmTab === "email" && (
                    <>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                        <div>
                          <div style={{fontSize:12,fontWeight:"bold",color:"#fff",fontFamily:"'Syne',sans-serif"}}>Outreach Email</div>
                          <div style={{fontSize:10,color:"#484f58",marginTop:2}}>→ {selected.email}</div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          {selected.generatedEmail && (
                            <button onClick={()=>copyEmail(selected)}
                              style={{...S.btn(copiedId===selected.id?"#4ade80":"#6b7280",copiedId!==selected.id),padding:"6px 12px"}}>
                              {copiedId===selected.id?"✓ Copied":"Copy"}
                            </button>
                          )}
                          <button onClick={generateEmail} disabled={generatingEmail}
                            style={{...S.btn("#a78bfa"),opacity:generatingEmail?0.5:1,cursor:generatingEmail?"not-allowed":"pointer"}}>
                            {generatingEmail?<><span className="pulse">⟳</span>Writing...</>:selected.generatedEmail?"↻ Regenerate":"Generate Email"}
                          </button>
                        </div>
                      </div>

                      {!selected.aiResearch && !selected.generatedEmail && (
                        <div style={{background:"rgba(250,204,21,0.04)",border:"1px solid rgba(250,204,21,0.15)",borderRadius:5,padding:"8px 12px",marginBottom:12,fontSize:10,color:"#d97706"}}>
                          💡 Run Research first for a more personalised email
                        </div>
                      )}

                      {!selected.generatedEmail && !generatingEmail && (
                        <div style={{...S.panel,padding:32,textAlign:"center",borderStyle:"dashed"}}>
                          <div style={{fontSize:24,marginBottom:8}}>✉️</div>
                          <div style={{fontSize:11,color:"#6b7280"}}>Generate a personalised cold outreach email using their specific incident</div>
                        </div>
                      )}

                      {generatingEmail && (
                        <div style={{...S.panel,padding:24,textAlign:"center"}}>
                          <div className="pulse" style={{fontSize:20,marginBottom:8}}>✉️</div>
                          <div style={{fontSize:11,color:"#6b7280"}}>Writing email for {selected.company}...</div>
                        </div>
                      )}

                      {selected.generatedEmail && !generatingEmail && (
                        <>
                          <textarea value={selected.generatedEmail}
                            onChange={e=>updateProspect(selected.id,{generatedEmail:e.target.value})} rows={16}
                            style={{...S.input,resize:"none",lineHeight:1.8,padding:"14px 16px",marginBottom:10}}/>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            <button onClick={()=>copyEmail(selected)} style={S.btn("#4ade80")}>
                              {copiedId===selected.id?"✓ Copied":"Copy Email"}
                            </button>
                            <a href={`mailto:${selected.email}`} style={{...S.btn("#60a5fa"),textDecoration:"none"}}>
                              Open in Mail
                            </a>
                            <button onClick={()=>updateProspect(selected.id,{outreachStatus:"contacted"})}
                              style={S.btn("#fb923c")}>
                              Mark Contacted
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}

                </div>
              </div>
            </div>
          ) : (
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}>
              <div style={{fontSize:32}}>🛡️</div>
              <div style={{fontSize:12,color:"#6b7280"}}>Select a prospect from the list</div>
              <button onClick={()=>setScreen("hunt")} style={S.btn("#4ade80")}>
                Hunt for more prospects →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
