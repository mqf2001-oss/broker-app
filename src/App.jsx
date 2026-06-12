import { useState, useRef, useEffect } from "react";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://zzptnlwvwbfogxaqjtzr.supabase.co";
const SUPABASE_KEY = "sb_publishable_Og4Uxd5kBrye0s2PjrEvUQ_Txyt11nG";

const sb = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": options.prefer || "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) { const e = await res.text(); console.error("Supabase error:", e); return null; }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const db = {
  getClients: () => sb("clients?select=*&order=created_at.asc"),
  createClient: (name) => sb("clients", { method: "POST", body: JSON.stringify({ name }) }),
  getInteractions: () => sb("interactions?select=*&order=date.desc"),
  createInteraction: (data) => sb("interactions", { method: "POST", body: JSON.stringify(data) }),
  updateInteraction: (id, data) => sb(`interactions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data), prefer: "return=minimal" }),
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const daysSince = (iso) => { if (!iso) return 999; return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); };
const heatColor = (days) => {
  if (days <= 2) return { bg: "#2ECC9A22", dot: "#2ECC9A", label: "Reciente" };
  if (days <= 7) return { bg: "#F59E0B22", dot: "#F59E0B", label: "Esta semana" };
  if (days <= 21) return { bg: "#F9731622", dot: "#F97316", label: "Hace semanas" };
  return { bg: "#EF444422", dot: "#EF4444", label: "Frío" };
};
const fmtDate = (iso) => { if (!iso) return "—"; return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); };
const fmtTime = (iso) => { if (!iso) return ""; return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); };
const fmtDateRange = (from, to) => `${new Date(from).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} – ${new Date(to).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}`;

// ─── SPEECH ───────────────────────────────────────────────────────────────────
const getSpeechRecognition = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR(); r.lang = "es-ES"; r.continuous = true; r.interimResults = true; return r;
};

// ─── CLAUDE API ───────────────────────────────────────────────────────────────
async function callClaude(messages, systemPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, system: systemPrompt, messages }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const icons = {
    mic: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>,
    stop: <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><rect x="4" y="4" width="16" height="16" rx="2"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    arrow: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
    bell: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    send: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    report: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    download: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    refresh: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  };
  return icons[name] || null;
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [clients, setClients] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [selectedClient, setSelectedClient] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [c, i] = await Promise.all([db.getClients(), db.getInteractions()]);
    if (c) setClients(c);
    if (i) setInteractions(i.map(row => ({ ...row, actions: row.actions || [] })));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const sortedClients = [...clients].sort((a, b) => {
    const aLast = interactions.filter(i => i.client_id === a.id).sort((x, y) => new Date(y.date) - new Date(x.date))[0]?.date || "0";
    const bLast = interactions.filter(i => i.client_id === b.id).sort((x, y) => new Date(y.date) - new Date(x.date))[0]?.date || "0";
    return new Date(bLast) - new Date(aLast);
  });

  const pendingNotifs = clients.map(c => {
    const pending = interactions.filter(i => i.client_id === c.id).flatMap(i => (i.actions || []).filter(a => !a.done));
    return pending.length > 0 ? { clientId: c.id, clientName: c.name, actions: pending } : null;
  }).filter(Boolean);

  const totalPending = pendingNotifs.reduce((s, n) => s + n.actions.length, 0);
  const openClient = (client) => { setSelectedClient(client); setTab("client"); };
  const goBack = () => { setSelectedClient(null); setTab("dashboard"); };

  if (loading) return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#0A1628", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#F7F8FA" }}>
      <div style={{ width: 52, height: 52, border: "3px solid #1E3A5F", borderTop: "3px solid #2ECC9A", borderRadius: "50%", animation: "spin 0.9s linear infinite", marginBottom: 16 }} />
      <p style={{ color: "#8BA5BE" }}>Cargando tus datos...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#0A1628", minHeight: "100vh", color: "#F7F8FA", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 90 }}>
      {tab === "dashboard" && <Dashboard clients={sortedClients} interactions={interactions} pendingNotifs={pendingNotifs} onClientClick={openClient} onRefresh={loadData} />}
      {tab === "record" && <RecordScreen clients={clients} interactions={interactions} setClients={setClients} setInteractions={setInteractions} onDone={() => { loadData(); setTab("dashboard"); }} />}
      {tab === "client" && selectedClient && <ClientScreen client={selectedClient} interactions={interactions} setInteractions={setInteractions} onBack={goBack} />}
      {tab === "pending" && <PendingScreen pendingNotifs={pendingNotifs} interactions={interactions} setInteractions={setInteractions} clients={clients} onClientClick={openClient} />}
      {tab === "report" && <ReportScreen clients={sortedClients} interactions={interactions} onBack={() => setTab("dashboard")} />}

      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#060F1E", borderTop: "1px solid #1E3A5F", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "10px 0 18px" }}>
        <NavBtn icon="users" label="Clientes" active={tab === "dashboard" || tab === "client"} onClick={goBack} />
        <NavBtn icon="bell" label="Pendientes" active={tab === "pending"} onClick={() => setTab("pending")} badge={totalPending} />
        <button onClick={() => setTab("record")} style={{ background: "#2ECC9A", border: "none", borderRadius: "50%", width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 0 28px #2ECC9A55", marginTop: -20, flexShrink: 0 }}>
          <Icon name="mic" size={26} color="#0A1628" />
        </button>
        <NavBtn icon="report" label="Informe" active={tab === "report"} onClick={() => setTab("report")} />
        <div style={{ width: 48 }} />
      </nav>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", color: active ? "#2ECC9A" : "#8BA5BE", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 10, position: "relative", padding: "4px 10px", minWidth: 52 }}>
      <div style={{ position: "relative" }}>
        <Icon name={icon} size={21} color={active ? "#2ECC9A" : "#8BA5BE"} />
        {badge > 0 && <span style={{ position: "absolute", top: -4, right: -7, background: "#EF4444", color: "#fff", borderRadius: 9, fontSize: 9, fontWeight: 700, padding: "1px 4px", minWidth: 14, textAlign: "center" }}>{badge}</span>}
      </div>
      {label}
    </button>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ clients, interactions, pendingNotifs, onClientClick, onRefresh }) {
  const coldCount = clients.filter(c => { const last = interactions.filter(i => i.client_id === c.id).sort((a, b) => new Date(b.date) - new Date(a.date))[0]; return daysSince(last?.date) >= 14; }).length;
  return (
    <div>
      <div style={{ padding: "32px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "#8BA5BE", fontSize: 13, margin: 0 }}>{new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 style={{ margin: "4px 0 8px", fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Mis Clientes</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ background: "#132338", color: "#8BA5BE", fontSize: 12, padding: "3px 10px", borderRadius: 20 }}>{clients.length} clientes</span>
            {coldCount > 0 && <span style={{ background: "#EF444418", color: "#EF4444", fontSize: 12, padding: "3px 10px", borderRadius: 20 }}>{coldCount} fríos</span>}
            {pendingNotifs.length > 0 && <span style={{ background: "#F59E0B18", color: "#F59E0B", fontSize: 12, padding: "3px 10px", borderRadius: 20 }}>{pendingNotifs.reduce((s,n)=>s+n.actions.length,0)} pendientes</span>}
          </div>
        </div>
        <button onClick={onRefresh} style={{ background: "#132338", border: "none", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <Icon name="refresh" size={16} color="#8BA5BE" />
        </button>
      </div>

      {clients.length === 0 && (
        <div style={{ textAlign: "center", padding: "70px 20px", color: "#8BA5BE" }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🎙️</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#F7F8FA", margin: "0 0 8px" }}>Sin clientes aún</p>
          <p style={{ fontSize: 14, margin: 0 }}>Pulsa el micrófono y graba tu primera llamada</p>
        </div>
      )}

      <div style={{ padding: "4px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {clients.map(client => {
          const ci = interactions.filter(i => i.client_id === client.id).sort((a, b) => new Date(b.date) - new Date(a.date));
          const last = ci[0];
          const heat = heatColor(daysSince(last?.date));
          const pending = ci.flatMap(i => (i.actions || []).filter(a => !a.done)).length;
          return (
            <button key={client.id} onClick={() => onClientClick(client)} style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 16, padding: "14px 16px", textAlign: "left", cursor: "pointer", width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: heat.dot, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.name}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#6B8FAD" }}>{last ? `Último contacto: ${fmtDate(last.date)}` : "Sin interacciones aún"}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0, marginLeft: 10 }}>
                  {pending > 0 && <span style={{ background: "#EF444418", color: "#EF4444", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{pending} pendiente{pending > 1 ? "s" : ""}</span>}
                  <span style={{ background: heat.bg, color: heat.dot, fontSize: 11, padding: "2px 8px", borderRadius: 20 }}>{heat.label}</span>
                </div>
              </div>
              {last?.summary && <p style={{ margin: "9px 0 0", fontSize: 13, color: "#6B8FAD", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{last.summary}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── PENDING SCREEN ───────────────────────────────────────────────────────────
function PendingScreen({ pendingNotifs, interactions, setInteractions, clients, onClientClick }) {
  const allPending = interactions
    .flatMap(i => (i.actions || []).filter(a => !a.done).map(a => ({ ...a, interactionId: i.id, interactionDate: i.date, clientId: i.client_id })))
    .sort((a, b) => new Date(a.interactionDate) - new Date(b.interactionDate));

  const toggleAction = async (interactionId, actionId) => {
    const interaction = interactions.find(i => i.id === interactionId);
    if (!interaction) return;
    const newActions = interaction.actions.map(a => a.id === actionId ? { ...a, done: !a.done } : a);
    await db.updateInteraction(interactionId, { actions: newActions });
    setInteractions(prev => prev.map(i => i.id === interactionId ? { ...i, actions: newActions } : i));
  };

  const getClient = (clientId) => clients.find(c => c.id === clientId);

  return (
    <div style={{ padding: "32px 20px 16px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Pendientes</h2>
      <p style={{ color: "#8BA5BE", fontSize: 14, margin: "0 0 20px" }}>{allPending.length} acción{allPending.length !== 1 ? "es" : ""} por completar</p>
      {allPending.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#8BA5BE" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#F7F8FA", margin: "0 0 8px" }}>¡Todo al día!</p>
          <p style={{ fontSize: 14, margin: 0 }}>No tienes acciones pendientes</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {allPending.map(action => {
          const client = getClient(action.clientId);
          return (
            <div key={`${action.interactionId}-${action.id}`} style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <button onClick={() => toggleAction(action.interactionId, action.id)} style={{ width: 22, height: 22, borderRadius: 7, border: "2px solid #2A4A6A", background: "transparent", flexShrink: 0, marginTop: 1, cursor: "pointer" }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 6px", color: "#E2EAF4" }}>{action.text}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => client && onClientClick(client)} style={{ background: "none", border: "none", color: "#2ECC9A", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>👤 {client?.name || "?"}</button>
                  <span style={{ color: "#3A5A78", fontSize: 12 }}>·</span>
                  <span style={{ color: "#6B8FAD", fontSize: 12 }}>{fmtDate(action.interactionDate)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── REPORT SCREEN ────────────────────────────────────────────────────────────
function ReportScreen({ clients, interactions }) {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [period, setPeriod] = useState("week");

  const generateReport = async () => {
    setGenerating(true);
    const to = new Date(); const from = new Date();
    if (period === "week") from.setDate(from.getDate() - 7); else from.setDate(from.getDate() - 30);
    const recent = interactions.filter(i => new Date(i.date) >= from && new Date(i.date) <= to);
    if (recent.length === 0) { setReport({ isEmpty: true }); setGenerating(false); return; }
    const summary = recent.map(i => { const c = clients.find(cl => cl.id === i.client_id); return `Cliente: ${c?.name || "?"} | ${fmtDate(i.date)} | ${i.summary} | Pendientes: ${(i.actions||[]).filter(a=>!a.done).length}`; }).join("\n\n");
    const cold = clients.filter(c => { const last = interactions.filter(i => i.client_id === c.id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0]; return daysSince(last?.date) >= 14; }).map(c => c.name);
    const totalPending = interactions.flatMap(i => (i.actions||[]).filter(a=>!a.done)).length;
    const text = await callClaude([{ role: "user", content: `Período: ${fmtDateRange(from.toISOString(), to.toISOString())}\n\nInteracciones:\n${summary}\n\nClientes fríos (+14 días): ${cold.join(", ")||"ninguno"}\nTotal pendientes: ${totalPending}` }],
      "Eres el asistente de un corredor de seguros español. Genera un informe profesional y accionable con estas secciones numeradas: 1. RESUMEN EJECUTIVO 2. ACTIVIDAD 3. LOGROS 4. PENDIENTE CRÍTICO 5. CLIENTES EN RIESGO 6. PRÓXIMOS PASOS. Sé específico con nombres. Tono directo y profesional.");
    setReport({ text, from, to }); setGenerating(false);
  };

  return (
    <div style={{ padding: "32px 20px 16px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Informe</h2>
      <p style={{ color: "#8BA5BE", fontSize: 14, margin: "0 0 20px" }}>Resumen de actividad generado por IA</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[{ value: "week", label: "Esta semana" }, { value: "month", label: "Este mes" }].map(p => (
          <button key={p.value} onClick={() => { setPeriod(p.value); setReport(null); }} style={{ flex: 1, background: period === p.value ? "#2ECC9A" : "#0D1F35", border: `1px solid ${period === p.value ? "#2ECC9A" : "#1A3550"}`, borderRadius: 12, padding: "11px 0", color: period === p.value ? "#0A1628" : "#8BA5BE", fontWeight: period === p.value ? 700 : 500, fontSize: 14, cursor: "pointer" }}>{p.label}</button>
        ))}
      </div>
      {!report && !generating && (
        <button onClick={generateReport} style={{ width: "100%", background: "linear-gradient(135deg,#2ECC9A,#1BA87C)", border: "none", borderRadius: 16, padding: "18px", color: "#0A1628", fontWeight: 700, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Icon name="report" size={22} color="#0A1628" /> Generar informe
        </button>
      )}
      {generating && (
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <div style={{ width: 52, height: 52, border: "3px solid #1E3A5F", borderTop: "3px solid #2ECC9A", borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#2ECC9A", fontWeight: 600 }}>Analizando tu actividad...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {report && !generating && (
        report.isEmpty ? (
          <div style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 16, padding: 20, textAlign: "center", color: "#8BA5BE" }}>
            <p>No hay interacciones en este período.</p>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#8BA5BE" }}>{fmtDateRange(report.from.toISOString(), report.to.toISOString())}</span>
              <button onClick={() => navigator.clipboard.writeText(report.text).catch(()=>{})} style={{ background: "#132338", border: "1px solid #1A3550", borderRadius: 8, padding: "6px 12px", color: "#2ECC9A", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="download" size={14} color="#2ECC9A" /> Copiar
              </button>
            </div>
            <div style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 16, padding: 20 }}>
              {report.text.split("\n").map((line, i) => {
                const isHeader = /^\d+\./.test(line.trim());
                return line.trim() ? <p key={i} style={{ margin: isHeader ? "16px 0 6px" : "0 0 6px", fontSize: isHeader ? 12 : 14, fontWeight: isHeader ? 700 : 400, color: isHeader ? "#2ECC9A" : "#D4E5F5", lineHeight: 1.7, textTransform: isHeader ? "uppercase" : "none", letterSpacing: isHeader ? 0.5 : 0 }}>{line}</p> : <div key={i} style={{ height: 4 }} />;
              })}
            </div>
            <button onClick={() => setReport(null)} style={{ marginTop: 14, width: "100%", background: "transparent", border: "1px solid #1A3550", borderRadius: 12, padding: 13, color: "#8BA5BE", fontSize: 14, cursor: "pointer" }}>Regenerar</button>
          </div>
        )
      )}
    </div>
  );
}

// ─── RECORD SCREEN ────────────────────────────────────────────────────────────
function RecordScreen({ clients, interactions, setClients, setInteractions, onDone }) {
  const [phase, setPhase] = useState("idle");
  const [liveText, setLiveText] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [processingMsg, setProcessingMsg] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [clarifyQ, setClarifyQ] = useState("");
  const [clarifyA, setClarifyA] = useState("");
  const [result, setResult] = useState(null);
  const [newClientName, setNewClientName] = useState("");
  const [speechSupported] = useState(() => !!getSpeechRecognition());
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState("");
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const recognitionRef = useRef(null);
  const finalRef = useRef("");
  const phaseRef = useRef("idle");
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const startRecording = () => {
    const recognition = getSpeechRecognition();
    if (!recognition) { setManualMode(true); return; }
    finalRef.current = ""; setFinalTranscript(""); setInterimText(""); setLiveText("");
    recognition.onresult = (e) => {
      let interim = "", newFinal = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) newFinal += t + " "; else interim += t; }
      if (newFinal) { finalRef.current += newFinal; setFinalTranscript(finalRef.current); }
      setInterimText(interim); setLiveText(finalRef.current + interim);
    };
    recognition.onerror = (e) => { if (e.error === "not-allowed") { setManualMode(true); setPhase("idle"); } };
    recognition.onend = () => { if (phaseRef.current === "recording" && recognitionRef.current) { try { recognitionRef.current.start(); } catch {} } };
    recognitionRef.current = recognition; recognition.start(); setPhase("recording");
  };

  const stopRecording = () => {
    phaseRef.current = "stopped"; recognitionRef.current?.stop(); recognitionRef.current = null;
    const text = finalRef.current.trim() || liveText.trim();
    if (!text) { setPhase("idle"); return; }
    setFinalTranscript(text); setPhase("processing"); analyzeTranscript(text);
  };

  const analyzeTranscript = async (text) => {
    setProcessingMsg("Analizando...");
    const clientList = clients.map(c => c.name).join(", ") || "ninguno";
    const response = await callClaude([{ role: "user", content: `Transcripción: "${text}"\n\nClientes: ${clientList}` }],
      `Eres asistente de un corredor de seguros español. Responde SOLO con JSON válido sin backticks:
{"clientDetected":"nombre o null","matchType":"exact"|"similar"|"new"|"unknown","similarClients":[],"summary":"resumen 2-3 frases","actions":["acción 1","acción 2"],"needsClarification":true/false,"clarificationQuestion":"pregunta o null"}`);
    let parsed; try { parsed = JSON.parse(response.replace(/```json|```/g,"").trim()); } catch { parsed = { matchType:"unknown", summary: text.slice(0,200), actions:[], needsClarification:false }; }
    setProcessingMsg("");
    if (parsed.needsClarification && parsed.clarificationQuestion) { setClarifyQ(parsed.clarificationQuestion); setResult(parsed); setPhase("clarifying"); return; }
    handleMatch(parsed);
  };

  const handleMatch = (parsed) => {
    const existingClient = clients.find(c => c.name.toLowerCase() === (parsed.clientDetected||"").toLowerCase());
    setResult(parsed);
    if (parsed.matchType === "exact" && existingClient) setConfirmation({ type: "existing", client: existingClient });
    else if (parsed.matchType === "new" && parsed.clientDetected) { setNewClientName(parsed.clientDetected); setConfirmation({ type: "new", name: parsed.clientDetected }); }
    else if ((parsed.matchType === "similar" || parsed.clientDetected) && !existingClient) { setNewClientName(parsed.clientDetected||""); setConfirmation({ type: "similar", name: parsed.clientDetected, similar: parsed.similarClients||[] }); }
    else setConfirmation({ type: "unknown" });
    setPhase("confirming");
  };

  const submitClarification = async () => { setPhase("processing"); await analyzeTranscript((finalTranscript||manualText) + "\n\nAclaración: " + clarifyA); };

  const saveInteraction = async (clientId) => {
    setSaving(true);
    const transcript = editingTranscript ? editedTranscript : (finalTranscript||manualText);
    const actions = (result?.actions||[]).map((a,i) => ({ id: i.toString(), text: a, done: false }));
    const newInt = await db.createInteraction({ client_id: clientId, transcript, summary: result?.summary||"", actions, date: new Date().toISOString() });
    if (newInt?.[0]) setInteractions(prev => [{ ...newInt[0], actions }, ...prev]);
    setSaving(false); setPhase("done");
  };

  const confirmExistingClient = (client) => saveInteraction(client.id);

  const confirmNewClient = async (name) => {
    if (!name.trim()) return;
    setSaving(true);
    const newC = await db.createClient(name.trim());
    if (newC?.[0]) { setClients(prev => [...prev, newC[0]]); await saveInteraction(newC[0].id); }
    setSaving(false);
  };

  const resetAll = () => { setPhase("idle"); setLiveText(""); setFinalTranscript(""); setInterimText(""); setResult(null); setConfirmation(null); setClarifyA(""); setClarifyQ(""); setNewClientName(""); setManualText(""); setManualMode(false); setEditingTranscript(false); };

  return (
    <div style={{ padding: "28px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Nueva grabación</h2>
        {phase !== "idle" && phase !== "done" && <button onClick={resetAll} style={{ background: "#132338", border: "none", borderRadius: 8, padding: "6px 12px", color: "#8BA5BE", fontSize: 13, cursor: "pointer" }}>Cancelar</button>}
      </div>
      <p style={{ color: "#8BA5BE", fontSize: 14, margin: "0 0 24px" }}>Habla después de cada llamada o reunión</p>

      {phase === "idle" && !manualMode && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {speechSupported ? (
            <button onClick={startRecording} style={{ background: "linear-gradient(135deg,#2ECC9A,#1BA87C)", border: "none", borderRadius: 18, padding: "22px", color: "#0A1628", fontWeight: 700, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, boxShadow: "0 8px 28px #2ECC9A33" }}>
              <Icon name="mic" size={28} color="#0A1628" /> Iniciar grabación de voz
            </button>
          ) : (
            <div style={{ background: "#F59E0B18", border: "1px solid #F59E0B44", borderRadius: 14, padding: 16, fontSize: 14, color: "#F59E0B", textAlign: "center" }}>Usa Chrome o Safari para la grabación de voz.</div>
          )}
          <button onClick={() => setManualMode(true)} style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 14, padding: "16px", color: "#8BA5BE", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>✏️ Escribir en su lugar</button>
        </div>
      )}

      {phase === "idle" && manualMode && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <textarea value={manualText} onChange={e => setManualText(e.target.value)} placeholder="Escribe lo que ocurrió. Menciona el nombre del cliente..." style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 14, padding: 16, color: "#F7F8FA", fontSize: 15, minHeight: 200, resize: "vertical", fontFamily: "inherit", lineHeight: 1.7 }} />
          <button onClick={() => { setPhase("processing"); analyzeTranscript(manualText.trim()); }} disabled={!manualText.trim()} style={{ background: manualText.trim() ? "linear-gradient(135deg,#2ECC9A,#1BA87C)" : "#1A3550", border: "none", borderRadius: 12, padding: 16, color: manualText.trim() ? "#0A1628" : "#8BA5BE", fontWeight: 700, fontSize: 16, cursor: manualText.trim() ? "pointer" : "not-allowed" }}>Analizar con IA →</button>
          <button onClick={() => setManualMode(false)} style={{ background: "transparent", border: "none", color: "#8BA5BE", fontSize: 14, cursor: "pointer" }}>← Volver a grabación</button>
        </div>
      )}

      {phase === "recording" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#EF444418", border: "2px solid #EF4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", animation: "pulse 1.4s ease-in-out infinite" }}>
              <Icon name="mic" size={36} color="#EF4444" />
            </div>
            <p style={{ color: "#EF4444", fontWeight: 700, fontSize: 15, margin: "0 0 4px" }}>Escuchando...</p>
          </div>
          <div style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 14, padding: 16, minHeight: 100, maxHeight: 200, overflowY: "auto" }}>
            {liveText ? <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}><span style={{ color: "#E2EAF4" }}>{finalTranscript}</span><span style={{ color: "#6B8FAD" }}>{interimText}</span></p>
              : <p style={{ fontSize: 14, color: "#3A5A78", margin: 0, fontStyle: "italic" }}>Tu voz aparecerá aquí...</p>}
          </div>
          <button onClick={stopRecording} style={{ background: "#EF4444", border: "none", borderRadius: 14, padding: "16px", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Icon name="stop" size={20} color="#fff" /> Detener y analizar
          </button>
          <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
        </div>
      )}

      {(phase === "processing" || saving) && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ width: 52, height: 52, border: "3px solid #1A3550", borderTop: "3px solid #2ECC9A", borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 20px" }} />
          <p style={{ color: "#2ECC9A", fontWeight: 600 }}>{saving ? "Guardando en la nube..." : processingMsg || "Procesando..."}</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {phase === "clarifying" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#0D1F35", border: "1px solid #2ECC9A44", borderRadius: 16, padding: 18 }}>
            <p style={{ color: "#2ECC9A", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 10px" }}>Necesito aclarar algo</p>
            <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>{clarifyQ}</p>
          </div>
          <textarea value={clarifyA} onChange={e => setClarifyA(e.target.value)} placeholder="Tu respuesta..." style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 12, padding: 14, color: "#F7F8FA", fontSize: 15, minHeight: 100, resize: "vertical", fontFamily: "inherit" }} />
          <button onClick={submitClarification} disabled={!clarifyA.trim()} style={{ background: clarifyA.trim() ? "#2ECC9A" : "#1A3550", border: "none", borderRadius: 12, padding: 14, color: clarifyA.trim() ? "#0A1628" : "#8BA5BE", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Continuar →</button>
        </div>
      )}

      {phase === "confirming" && confirmation && result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ color: "#6B8FAD", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Transcripción</p>
              <button onClick={() => { setEditingTranscript(!editingTranscript); setEditedTranscript(finalTranscript||manualText); }} style={{ background: "none", border: "none", color: "#2ECC9A", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="edit" size={12} color="#2ECC9A" /> Editar
              </button>
            </div>
            {editingTranscript ? <textarea value={editedTranscript} onChange={e => setEditedTranscript(e.target.value)} style={{ background: "#132338", border: "1px solid #2ECC9A44", borderRadius: 8, padding: 10, color: "#F7F8FA", fontSize: 13, width: "100%", minHeight: 80, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
              : <p style={{ fontSize: 13, color: "#6B8FAD", lineHeight: 1.6, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{finalTranscript||manualText}</p>}
          </div>
          {result.summary && <div style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 14, padding: 14 }}><p style={{ color: "#6B8FAD", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Resumen</p><p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{result.summary}</p></div>}
          {result.actions?.length > 0 && <div style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 14, padding: 14 }}><p style={{ color: "#6B8FAD", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 10px" }}>Acciones</p>{result.actions.map((a,i)=><div key={i} style={{ display:"flex", gap:8, marginBottom:7 }}><span style={{ color:"#2ECC9A", fontWeight:700, flexShrink:0 }}>→</span><span style={{ fontSize:14, lineHeight:1.5 }}>{a}</span></div>)}</div>}

          {confirmation.type === "existing" && (
            <div style={{ background: "#0D1F35", border: "1px solid #2ECC9A55", borderRadius: 14, padding: 16 }}>
              <p style={{ color: "#2ECC9A", fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>¿Es este el cliente?</p>
              <p style={{ fontSize: 17, fontWeight: 700, margin: "0 0 14px" }}>👤 {confirmation.client.name}</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => confirmExistingClient(confirmation.client)} style={{ flex: 1, background: "#2ECC9A", border: "none", borderRadius: 10, padding: 13, color: "#0A1628", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>Sí, guardar</button>
                <button onClick={() => setConfirmation({ type: "unknown" })} style={{ flex: 1, background: "#132338", border: "1px solid #1A3550", borderRadius: 10, padding: 13, color: "#F7F8FA", fontWeight: 600, cursor: "pointer", fontSize: 15 }}>No, cambiar</button>
              </div>
            </div>
          )}
          {confirmation.type === "new" && (
            <div style={{ background: "#0D1F35", border: "1px solid #F59E0B55", borderRadius: 14, padding: 16 }}>
              <p style={{ color: "#F59E0B", fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>¿Crear nuevo cliente?</p>
              <input value={newClientName} onChange={e => setNewClientName(e.target.value)} style={{ background: "#132338", border: "1px solid #1A3550", borderRadius: 8, padding: "11px 14px", color: "#F7F8FA", fontSize: 15, width: "100%", boxSizing: "border-box", marginBottom: 12, fontFamily: "inherit" }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => confirmNewClient(newClientName)} disabled={!newClientName.trim()} style={{ flex: 1, background: newClientName.trim() ? "#F59E0B" : "#1A3550", border: "none", borderRadius: 10, padding: 13, color: newClientName.trim() ? "#0A1628" : "#8BA5BE", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>Crear y guardar</button>
                <button onClick={() => setConfirmation({ type: "unknown" })} style={{ flex: 1, background: "#132338", border: "1px solid #1A3550", borderRadius: 10, padding: 13, color: "#F7F8FA", fontWeight: 600, cursor: "pointer", fontSize: 15 }}>Es existente</button>
              </div>
            </div>
          )}
          {(confirmation.type === "similar" || confirmation.type === "unknown") && (
            <div style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 14, padding: 16 }}>
              <p style={{ color: "#8BA5BE", fontSize: 14, margin: "0 0 12px" }}>{confirmation.type === "similar" ? `No encontré coincidencia exacta para "${confirmation.name}". ¿Es alguno de estos?` : "¿A qué cliente corresponde?"}</p>
              <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {clients.map(c => <button key={c.id} onClick={() => confirmExistingClient(c)} style={{ background: "#132338", border: "1px solid #1A3550", borderRadius: 8, padding: "11px 14px", color: "#F7F8FA", textAlign: "left", cursor: "pointer", fontSize: 15 }}>👤 {c.name}</button>)}
              </div>
              <p style={{ color: "#6B8FAD", fontSize: 13, margin: "0 0 8px" }}>O nuevo cliente:</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre" style={{ flex: 1, background: "#132338", border: "1px solid #1A3550", borderRadius: 8, padding: "11px 14px", color: "#F7F8FA", fontSize: 14, fontFamily: "inherit" }} />
                <button onClick={() => newClientName.trim() && confirmNewClient(newClientName)} style={{ background: "#2ECC9A", border: "none", borderRadius: 8, padding: "10px 16px", color: "#0A1628", fontWeight: 700, cursor: "pointer" }}>
                  <Icon name="plus" size={18} color="#0A1628" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "done" && (
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#2ECC9A18", border: "2px solid #2ECC9A", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Icon name="check" size={32} color="#2ECC9A" />
          </div>
          <p style={{ fontWeight: 700, fontSize: 18, margin: "0 0 6px" }}>¡Guardado en la nube! ☁️</p>
          <p style={{ color: "#8BA5BE", fontSize: 14, margin: "0 0 32px" }}>Disponible en todos tus dispositivos</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={resetAll} style={{ flex: 1, background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 12, padding: 14, color: "#F7F8FA", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>Nueva grabación</button>
            <button onClick={onDone} style={{ flex: 1, background: "#2ECC9A", border: "none", borderRadius: 12, padding: 14, color: "#0A1628", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Ver clientes</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CLIENT SCREEN ────────────────────────────────────────────────────────────
function ClientScreen({ client, interactions, setInteractions, onBack }) {
  const [askingAI, setAskingAI] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");

  const clientInteractions = interactions.filter(i => i.client_id === client.id).sort((a, b) => new Date(b.date) - new Date(a.date));

  const toggleAction = async (interactionId, actionId) => {
    const interaction = interactions.find(i => i.id === interactionId);
    if (!interaction) return;
    const newActions = interaction.actions.map(a => a.id === actionId ? { ...a, done: !a.done } : a);
    await db.updateInteraction(interactionId, { actions: newActions });
    setInteractions(prev => prev.map(i => i.id === interactionId ? { ...i, actions: newActions } : i));
  };

  const askAI = async () => {
    if (!aiQuestion.trim()) return;
    setAskingAI(true);
    const history = clientInteractions.map(i => `[${fmtDate(i.date)}] ${i.summary}\nAcciones: ${(i.actions||[]).map(a=>`${a.done?"✓":"·"} ${a.text}`).join(", ")}`).join("\n\n");
    const answer = await callClaude([{ role: "user", content: `Cliente: ${client.name}\n\nHistorial:\n${history||"Sin historial"}\n\nPregunta: ${aiQuestion}` }], "Eres el asistente de un corredor de seguros español. Responde de forma concisa y práctica.");
    setAiAnswer(answer); setAskingAI(false); setAiQuestion("");
  };

  const pendingCount = clientInteractions.flatMap(i => (i.actions||[]).filter(a => !a.done)).length;
  const doneCount = clientInteractions.flatMap(i => (i.actions||[]).filter(a => a.done)).length;

  return (
    <div>
      <div style={{ padding: "22px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "#132338", border: "none", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <Icon name="arrow" size={20} color="#F7F8FA" />
        </button>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.name}</h2>
          <p style={{ margin: 0, fontSize: 12, color: "#6B8FAD" }}>Cliente desde {fmtDate(client.created_at)}</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, padding: "14px 20px" }}>
        <Stat label="Llamadas" value={clientInteractions.length} color="#2ECC9A" />
        <Stat label="Pendientes" value={pendingCount} color="#EF4444" />
        <Stat label="Hechas" value={doneCount} color="#6B8FAD" />
      </div>
      <div style={{ margin: "0 20px 20px", background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 16, padding: 16 }}>
        <p style={{ color: "#2ECC9A", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 10px" }}>Pregunta sobre este cliente</p>
        {aiAnswer && <div style={{ marginBottom: 12, padding: 14, background: "#132338", borderRadius: 12, fontSize: 14, lineHeight: 1.7, color: "#E2EAF4", borderLeft: "3px solid #2ECC9A" }}>{aiAnswer}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={aiQuestion} onChange={e => setAiQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()} placeholder="¿Cuál es el siguiente paso?" style={{ flex: 1, background: "#132338", border: "1px solid #1A3550", borderRadius: 10, padding: "11px 14px", color: "#F7F8FA", fontSize: 14, fontFamily: "inherit" }} />
          <button onClick={askAI} disabled={askingAI || !aiQuestion.trim()} style={{ background: aiQuestion.trim() ? "#2ECC9A" : "#132338", border: "none", borderRadius: 10, padding: "11px 14px", cursor: "pointer" }}>
            {askingAI ? <div style={{ width: 16, height: 16, border: "2px solid #0A1628", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin2 0.8s linear infinite" }} /> : <Icon name="send" size={16} color={aiQuestion.trim() ? "#0A1628" : "#6B8FAD"} />}
          </button>
        </div>
        <style>{`@keyframes spin2{to{transform:rotate(360deg)}}`}</style>
      </div>
      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {clientInteractions.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: "#6B8FAD" }}><p>Sin interacciones aún</p></div>}
        {clientInteractions.map(interaction => (
          <div key={interaction.id} style={{ background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "#2ECC9A", fontWeight: 700 }}>{fmtDate(interaction.date)}</span>
              <span style={{ fontSize: 12, color: "#6B8FAD" }}>{fmtTime(interaction.date)}</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.65, margin: "0 0 12px", color: "#D4E5F5" }}>{interaction.summary}</p>
            {interaction.actions?.length > 0 && (
              <div style={{ borderTop: "1px solid #1A3550", paddingTop: 12 }}>
                <p style={{ fontSize: 11, color: "#6B8FAD", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Acciones</p>
                {interaction.actions.map(action => (
                  <button key={action.id} onClick={() => toggleAction(interaction.id, action.id)} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "none", border: "none", cursor: "pointer", padding: "5px 0", width: "100%", textAlign: "left" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${action.done ? "#2ECC9A" : "#2A4A6A"}`, background: action.done ? "#2ECC9A" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.15s" }}>
                      {action.done && <Icon name="check" size={11} color="#0A1628" />}
                    </div>
                    <span style={{ fontSize: 14, color: action.done ? "#3A6A4A" : "#D4E5F5", textDecoration: action.done ? "line-through" : "none", lineHeight: 1.5 }}>{action.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: "#0D1F35", border: "1px solid #1A3550", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6B8FAD" }}>{label}</p>
    </div>
  );
}
