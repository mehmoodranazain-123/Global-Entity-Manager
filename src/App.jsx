import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, Building2, Users, FileText, KeyRound, ShieldCheck, ListChecks, Bot,
  Settings as SettingsIcon, Search, Plus, X, ChevronRight, ChevronLeft, AlertTriangle,
  Landmark, CreditCard, Globe, Eye, EyeOff, Trash2, ArrowLeft, Clock, CheckCircle2,
  TrendingUp, Briefcase, Lock, Menu, Send, Sparkles, FileWarning, ClipboardList, LogOut, Mail
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import { supabase } from "./supabaseClient";

/* ---------------------------------- constants ---------------------------------- */

const JURISDICTIONS = ["USA", "UK", "EU", "UAE"];
const JUR_STYLE = {
  USA: { dot: "bg-sky-500", text: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200", hex: "#0284c7" },
  UK: { dot: "bg-violet-500", text: "text-violet-700", bg: "bg-violet-50", ring: "ring-violet-200", hex: "#7c3aed" },
  EU: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200", hex: "#d97706" },
  UAE: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200", hex: "#059669" },
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "directors", label: "Directors", icon: Users },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "credentials", label: "Credentials", icon: KeyRound },
  { id: "compliance", label: "Annual Compliance", icon: ShieldCheck },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "ai", label: "AI Assistant", icon: Bot },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const ROLES = [
  { name: "Super Admin", desc: "Full access to every module, credential and role setting." },
  { name: "Admin", desc: "Manage companies, filings and documents across all jurisdictions." },
  { name: "Compliance Manager", desc: "Own compliance calendar, filings, and deadline reminders." },
  { name: "Staff", desc: "Handle assigned companies, tasks and document uploads." },
  { name: "Read Only", desc: "View every module without the ability to add, edit or delete." },
  { name: "Client Portal", desc: "External view limited to a client's own linked companies." },
];

const REF_DATE = new Date();
const COMPANY_TABS = ["Overview", "Directors", "Shareholders", "UBOs", "Documents", "Compliance", "Bank Accounts", "Payment Gateways", "Credentials", "Tasks", "Notes", "Activity"];
const DOC_CATEGORIES = ["Incorporation Certificate", "Articles", "EIN", "Tax Documents", "Passports", "Utility Bills", "Contracts", "Bank Letters", "Compliance Files", "Other Documents"];
const COMPLIANCE_TYPES = ["Annual Return", "Confirmation Statement", "Tax Filing", "VAT Return", "Registered Agent Renewal", "Registered Office Renewal", "Jurisdiction Filing"];

/* ------------------------------------ utils ------------------------------------ */

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const parseDate = (s) => new Date(s + "T00:00:00");
const fmtDate = (s) => (s ? parseDate(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const daysUntil = (s) => Math.round((parseDate(s) - REF_DATE) / 86400000);
const isOverdue = (s) => daysUntil(s) < 0;
const isWithin = (s, n) => { const d = daysUntil(s); return d >= 0 && d <= n; };
const relTime = (iso) => {
  const diff = Math.round((REF_DATE - new Date(iso)) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
};
const monthName = (m) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m];

/* ---------------------------------- seed data ---------------------------------- */

function seedData() {
  // Fresh client workspace — no sample companies, directors, documents,
  // credentials, filings, tasks or activity. Everything is added by the user.
  const companies = [];
  const directors = [];
  const documents = [];
  const credentials = [];
  const compliance = [];
  const tasks = [];
  const activity = [];
  const trend = [
    { month: "Jan", completed: 0, pending: 0, overdue: 0 },
    { month: "Feb", completed: 0, pending: 0, overdue: 0 },
    { month: "Mar", completed: 0, pending: 0, overdue: 0 },
    { month: "Apr", completed: 0, pending: 0, overdue: 0 },
    { month: "May", completed: 0, pending: 0, overdue: 0 },
    { month: "Jun", completed: 0, pending: 0, overdue: 0 },
  ];
  const kycQueue = [];
  const applicationQueue = [];

  return { companies, directors, documents, credentials, compliance, tasks, activity, trend, kycQueue, applicationQueue };
}

/* ---------------------------------- small atoms --------------------------------- */

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700", emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700", rose: "bg-rose-100 text-rose-700",
    sky: "bg-sky-100 text-sky-700", violet: "bg-violet-100 text-violet-700",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone] || tones.slate}`}>{children}</span>;
}

function statusTone(status) {
  if (["Active", "Done", "Completed"].includes(status)) return "emerald";
  if (["Pending", "In Progress"].includes(status)) return "amber";
  if (["Overdue", "Resigned"].includes(status)) return "rose";
  return "slate";
}

function JurBadge({ jurisdiction }) {
  const s = JUR_STYLE[jurisdiction] || JUR_STYLE.USA;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text} ring-1 ${s.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {jurisdiction}
    </span>
  );
}

function KPICard({ icon: Icon, label, value, sub, tone = "slate", onClick }) {
  const tones = { slate: "text-slate-500", rose: "text-rose-500", amber: "text-amber-500", emerald: "text-emerald-500", indigo: "text-indigo-500" };
  return (
    <button onClick={onClick} className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <Icon size={16} className={tones[tone]} strokeWidth={2} />
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
    </button>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} mt-4`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div className="text-center py-14 text-slate-400">
      <Icon size={30} className="mx-auto mb-3 opacity-50" />
      <div className="font-medium text-slate-500">{title}</div>
      {sub && <div className="text-sm mt-1">{sub}</div>}
    </div>
  );
}

/* ---------------------------------- layout shell --------------------------------- */

function Sidebar({ page, go, role, mobileOpen, setMobileOpen, userEmail, onSignOut }) {
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed md:static z-40 top-0 left-0 h-full w-64 bg-white text-slate-600 flex flex-col border-r border-slate-200 transition-transform ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">G</div>
          <span className="font-semibold text-slate-900 tracking-tight">Global Entity Manager</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = page === n.id;
            return (
              <button key={n.id} onClick={() => { go(n.id); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
                <Icon size={16} strokeWidth={2} /> {n.label}
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700 shrink-0">
              {(userEmail || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate">{userEmail || "Signed in"}</div>
              <div className="text-xs text-slate-400 truncate">{role}</div>
            </div>
          </div>
          <button onClick={onSignOut} className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-rose-600 px-1 py-1.5">
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

function TopBar({ title, data, go, setMobileOpen }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    if (!q.trim()) return null;
    const s = q.toLowerCase();
    const companies = data.companies.filter((c) => c.name.toLowerCase().includes(s)).slice(0, 4);
    const directors = data.directors.filter((d) => d.fullName.toLowerCase().includes(s)).slice(0, 4);
    const documents = data.documents.filter((d) => d.name.toLowerCase().includes(s)).slice(0, 4);
    return { companies, directors, documents };
  }, [q, data]);

  return (
    <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="h-16 px-4 md:px-6 flex items-center gap-3">
        <button className="md:hidden text-slate-500" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
        <h1 className="text-lg font-semibold text-slate-900 whitespace-nowrap">{title}</h1>
        <div className="flex-1 relative max-w-md ml-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies, directors, documents…"
            className="w-full bg-slate-100 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          {results && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
              {["companies", "directors", "documents"].map((k) =>
                results[k].length > 0 && (
                  <div key={k} className="p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 px-2 py-1">{k}</div>
                    {results[k].map((r) => (
                      <button key={r.id} onClick={() => { go(k === "documents" ? "documents" : k, k === "companies" ? r.id : k === "directors" ? r.id : null); setQ(""); }}
                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 text-sm text-slate-700">
                        {r.name || r.fullName}
                      </button>
                    ))}
                  </div>
                )
              )}
              {results.companies.length === 0 && results.directors.length === 0 && results.documents.length === 0 && (
                <div className="p-4 text-sm text-slate-400">No matches found.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------ dashboard ---------------------------------- */

function MiniCalendar({ compliance, companies }) {
  const [cursor, setCursor] = useState(new Date(REF_DATE.getFullYear(), REF_DATE.getMonth(), 1));
  const [selected, setSelected] = useState(null);
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dueMap = {};
  compliance.forEach((c) => {
    const dt = parseDate(c.dueDate);
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      const key = dt.getDate();
      dueMap[key] = dueMap[key] || [];
      dueMap[key].push(c);
    }
  });

  const selectedItems = selected ? (dueMap[selected] || []) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => { setCursor(new Date(year, month - 1, 1)); setSelected(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={16} /></button>
        <span className="text-sm font-medium text-slate-700">{monthName(month)} {year}</span>
        <button onClick={() => { setCursor(new Date(year, month + 1, 1)); setSelected(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-slate-400 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const items = dueMap[d];
          const today = year === REF_DATE.getFullYear() && month === REF_DATE.getMonth() && d === REF_DATE.getDate();
          return (
            <button key={i} onClick={() => items && setSelected(d)}
              className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 relative
                ${today ? "ring-1 ring-indigo-400" : ""} ${selected === d ? "bg-indigo-50" : items ? "hover:bg-slate-50" : ""}`}>
              <span className={today ? "font-semibold text-indigo-600" : "text-slate-600"}>{d}</span>
              {items && <span className="w-1 h-1 rounded-full bg-amber-500" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3 space-y-2 max-h-40 overflow-y-auto">
        {(selected ? selectedItems : compliance.filter((c) => isWithin(c.dueDate, 30)).slice(0, 4)).map((c) => {
          const co = companies.find((x) => x.id === c.companyId);
          return (
            <div key={c.id} className="flex items-center justify-between text-xs">
              <div className="min-w-0">
                <div className="text-slate-700 font-medium truncate">{c.title}</div>
                <div className="text-slate-400 truncate">{co?.name}</div>
              </div>
              <span className="text-slate-400 whitespace-nowrap ml-2">{fmtDate(c.dueDate)}</span>
            </div>
          );
        })}
        {!selected && compliance.filter((c) => isWithin(c.dueDate, 30)).length === 0 && (
          <div className="text-xs text-slate-400">Nothing due in the next 30 days.</div>
        )}
      </div>
    </div>
  );
}

function Dashboard({ data, go }) {
  const { companies, compliance, documents, activity, trend, kycQueue, applicationQueue } = data;
  const jurisdictions = new Set(companies.map((c) => c.jurisdiction));
  const upcoming = compliance.filter((c) => isWithin(c.dueDate, 30)).length;
  const overdue = compliance.filter((c) => isOverdue(c.dueDate)).length;
  const taxDeadlines = compliance.filter((c) => ["Tax Filing", "VAT Return"].includes(c.type) && isWithin(c.dueDate, 60)).length;
  const expiringDocs = documents.filter((d) => d.expiryDate && isWithin(d.expiryDate, 60)).length;

  const jurData = JURISDICTIONS.map((j) => ({ name: j, value: companies.filter((c) => c.jurisdiction === j).length })).filter((d) => d.value > 0);
  const entityTypes = {};
  companies.forEach((c) => { entityTypes[c.entityType] = (entityTypes[c.entityType] || 0) + 1; });
  const industries = {};
  companies.forEach((c) => { industries[c.industry] = (industries[c.industry] || 0) + 1; });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard icon={Building2} label="Total Companies" value={companies.length} sub={`${companies.length} active`} onClick={() => go("companies")} />
        <KPICard icon={Globe} label="Jurisdictions" value={jurisdictions.size} sub="Managed regions" onClick={() => go("companies")} />
        <KPICard icon={Clock} label="Upcoming Deadlines" value={upcoming} sub="Next 30 days" tone="amber" onClick={() => go("compliance")} />
        <KPICard icon={AlertTriangle} label="Overdue Filings" value={overdue} sub="Requires action" tone={overdue ? "rose" : "slate"} onClick={() => go("compliance")} />
        <KPICard icon={Landmark} label="Tax Deadlines" value={taxDeadlines} sub="Next 60 days" tone="indigo" onClick={() => go("compliance")} />
        <KPICard icon={FileWarning} label="Expiring Documents" value={expiringDocs} sub="Next 60 days" tone="amber" onClick={() => go("documents")} />
        <KPICard icon={ShieldCheck} label="Pending KYC" value={kycQueue.length} sub="In progress" onClick={() => go("directors")} />
        <KPICard icon={CreditCard} label="Pending Applications" value={applicationQueue.length} sub="Bank & Payment" onClick={() => go("credentials")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 lg:col-span-1">
          <div className="mb-1 font-semibold text-slate-800 text-sm">Companies by Jurisdiction</div>
          <div className="text-xs text-slate-400 mb-2">Distribution across managed regions</div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={jurData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {jurData.map((d) => <Cell key={d.name} fill={JUR_STYLE[d.name].hex} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-1">
            {jurData.map((d) => (
              <span key={d.name} className="text-xs flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full" style={{ background: JUR_STYLE[d.name].hex }} /> {d.name}: {d.value}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 lg:col-span-2">
          <div className="mb-1 font-semibold text-slate-800 text-sm">Compliance Trends</div>
          <div className="text-xs text-slate-400 mb-2">Last 6 months performance</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completed" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="pending" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="overdue" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="font-semibold text-slate-800 text-sm mb-3">Compliance Calendar</div>
          <MiniCalendar compliance={compliance} companies={companies} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="font-semibold text-slate-800 text-sm mb-3">Recent Activity</div>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {activity.map((a) => (
              <div key={a.id} className="flex gap-2.5 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
                <div className="min-w-0">
                  <div className="text-slate-700"><span className="font-medium">{a.user}</span> · {a.action}</div>
                  <div className="text-xs text-slate-400 truncate">{a.detail}</div>
                </div>
                <div className="text-xs text-slate-400 ml-auto whitespace-nowrap">{relTime(a.ts)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="font-semibold text-slate-800 text-sm mb-3">Company Statistics</div>
          <div className="text-xs font-medium text-slate-400 mb-1.5">By Entity Type</div>
          <div className="space-y-1.5 mb-3">
            {Object.entries(entityTypes).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs text-slate-600"><span className="truncate pr-2">{k}</span><span className="font-medium text-slate-800">{v}</span></div>
            ))}
          </div>
          <div className="text-xs font-medium text-slate-400 mb-1.5">By Industry</div>
          <div className="space-y-1.5">
            {Object.entries(industries).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs text-slate-600"><span className="truncate pr-2">{k}</span><span className="font-medium text-slate-800">{v}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------ companies ---------------------------------- */

function AddCompanyModal({ onClose, onSave }) {
  const [f, setF] = useState({ name: "", legalName: "", jurisdiction: "USA", entityType: "", regNumber: "", regDate: "", status: "Active", registeredOffice: "", registeredAgent: "", taxId: "", renewalDate: "", taxDueDate: "", industry: "", notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Add Company" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-x-4 max-h-[65vh] overflow-y-auto pr-1">
        <Field label="Company Name"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
        <Field label="Legal Name"><input className={inputCls} value={f.legalName} onChange={set("legalName")} /></Field>
        <Field label="Jurisdiction">
          <select className={inputCls} value={f.jurisdiction} onChange={set("jurisdiction")}>
            {JURISDICTIONS.map((j) => <option key={j}>{j}</option>)}
          </select>
        </Field>
        <Field label="Entity Type"><input className={inputCls} value={f.entityType} onChange={set("entityType")} /></Field>
        <Field label="Registration Number"><input className={inputCls} value={f.regNumber} onChange={set("regNumber")} /></Field>
        <Field label="Registration Date"><input type="date" className={inputCls} value={f.regDate} onChange={set("regDate")} /></Field>
        <Field label="Registered Office"><input className={inputCls} value={f.registeredOffice} onChange={set("registeredOffice")} /></Field>
        <Field label="Registered Agent"><input className={inputCls} value={f.registeredAgent} onChange={set("registeredAgent")} /></Field>
        <Field label="EIN / Tax ID / VAT"><input className={inputCls} value={f.taxId} onChange={set("taxId")} /></Field>
        <Field label="Industry"><input className={inputCls} value={f.industry} onChange={set("industry")} /></Field>
        <Field label="Annual Renewal Date"><input type="date" className={inputCls} value={f.renewalDate} onChange={set("renewalDate")} /></Field>
        <Field label="Tax Due Date"><input type="date" className={inputCls} value={f.taxDueDate} onChange={set("taxDueDate")} /></Field>
        <div className="col-span-2"><Field label="Notes"><textarea className={inputCls} rows={2} value={f.notes} onChange={set("notes")} /></Field></div>
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={() => f.name && onSave({ ...f, id: uid("co"), directorIds: [], shareholders: [], ubos: [], bankAccounts: [], paymentGateways: [] })}
          className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Add Company</button>
      </div>
    </Modal>
  );
}

function CompaniesList({ data, go, setData, addActivity, readOnly }) {
  const [q, setQ] = useState("");
  const [jur, setJur] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const filtered = data.companies.filter((c) => (jur === "All" || c.jurisdiction === jur) && c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies…" className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <select value={jur} onChange={(e) => setJur(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-600">
            <option>All</option>
            {JURISDICTIONS.map((j) => <option key={j}>{j}</option>)}
          </select>
        </div>
        {!readOnly && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3.5 py-2 rounded-lg hover:bg-indigo-700">
            <Plus size={15} /> Add Company
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Jurisdiction</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Entity Type</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Renewal Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => go("companies", c.id)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.regNumber}</div>
                </td>
                <td className="px-4 py-3"><JurBadge jurisdiction={c.jurisdiction} /></td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-600">{c.entityType}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{fmtDate(c.renewalDate)}</td>
                <td className="px-4 py-3"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5}><EmptyState icon={Building2} title="No companies found" sub="Try a different search or filter." /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddCompanyModal onClose={() => setShowAdd(false)} onSave={(co) => {
          setData((d) => ({ ...d, companies: [co, ...d.companies] }));
          addActivity("Created company", co.name);
          setShowAdd(false);
        }} />
      )}
    </div>
  );
}

function CompanyDetail({ company, data, setData, go, addActivity, readOnly }) {
  const [tab, setTab] = useState("Overview");
  const directors = data.directors.filter((d) => company.directorIds.includes(d.id));
  const docs = data.documents.filter((d) => d.companyId === company.id);
  const comp = data.compliance.filter((c) => c.companyId === company.id);
  const tasks = data.tasks.filter((t) => t.companyId === company.id);
  const [note, setNote] = useState("");
  const [linkDirectorId, setLinkDirectorId] = useState("");
  const unlinkedDirectors = data.directors.filter((d) => !company.directorIds.includes(d.id));

  const linkDirector = (directorId) => {
    if (!directorId) return;
    setData((d) => ({
      ...d,
      companies: d.companies.map((c) => c.id === company.id ? { ...c, directorIds: [...c.directorIds, directorId] } : c),
      directors: d.directors.map((dir) => dir.id === directorId ? { ...dir, companyIds: [...dir.companyIds, company.id] } : dir),
    }));
    const dirName = data.directors.find((d) => d.id === directorId)?.fullName;
    addActivity("Linked director", `${dirName} to ${company.name}`);
    setLinkDirectorId("");
  };

  const unlinkDirector = (directorId) => {
    setData((d) => ({
      ...d,
      companies: d.companies.map((c) => c.id === company.id ? { ...c, directorIds: c.directorIds.filter((id) => id !== directorId) } : c),
      directors: d.directors.map((dir) => dir.id === directorId ? { ...dir, companyIds: dir.companyIds.filter((id) => id !== company.id) } : dir),
    }));
    const dirName = data.directors.find((d) => d.id === directorId)?.fullName;
    addActivity("Unlinked director", `${dirName} from ${company.name}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <button onClick={() => go("companies")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> Back to Companies</button>

      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-900">{company.name}</h2>
            <JurBadge jurisdiction={company.jurisdiction} />
            <Badge tone={statusTone(company.status)}>{company.status}</Badge>
          </div>
          <div className="text-sm text-slate-500 mt-1">{company.legalName} · {company.entityType}</div>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div>Registration No. <span className="text-slate-700 font-medium">{company.regNumber}</span></div>
          <div>Registered {fmtDate(company.regDate)}</div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {COMPANY_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === t ? "border-indigo-600 text-indigo-700 font-medium" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{t}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        {tab === "Overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ["Registered Office", company.registeredOffice], ["Registered Agent", company.registeredAgent],
              ["EIN / Tax ID / VAT", company.taxId], ["Industry", company.industry],
              ["Annual Renewal Date", fmtDate(company.renewalDate)], ["Tax Due Date", fmtDate(company.taxDueDate)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-50 py-2">
                <span className="text-slate-400">{k}</span><span className="text-slate-700 font-medium text-right">{v}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "Directors" && (
          <div className="space-y-4">
            {!readOnly && (
              <div className="flex gap-2">
                <select value={linkDirectorId} onChange={(e) => setLinkDirectorId(e.target.value)} className={inputCls}>
                  <option value="">Select a director to link…</option>
                  {unlinkedDirectors.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
                </select>
                <button onClick={() => linkDirector(linkDirectorId)} disabled={!linkDirectorId} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 whitespace-nowrap">Link</button>
              </div>
            )}
            <div className="space-y-2">
              {directors.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                  <div onClick={() => go("directors", d.id)} className="cursor-pointer hover:opacity-70 flex-1">
                    <div className="font-medium text-slate-800">{d.fullName}</div>
                    <div className="text-xs text-slate-400">{d.nationality} · Appointed {fmtDate(d.appointmentDate)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                    {!readOnly && <button onClick={() => unlinkDirector(d.id)} className="text-xs text-slate-400 hover:text-rose-600 px-1">Unlink</button>}
                  </div>
                </div>
              ))}
              {directors.length === 0 && <EmptyState icon={Users} title="No directors linked" sub="Use the dropdown above to link one." />}
            </div>
          </div>
        )}

        {tab === "Shareholders" && (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100"><th className="py-2">Name</th><th className="py-2">Ownership</th></tr></thead>
            <tbody>{company.shareholders.map((s, i) => <tr key={i} className="border-b border-slate-50"><td className="py-2 text-slate-700">{s.name}</td><td className="py-2 text-slate-700">{s.pct}%</td></tr>)}</tbody>
          </table>
        )}

        {tab === "UBOs" && (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100"><th className="py-2">Name</th><th className="py-2">Ownership</th><th className="py-2">Nationality</th></tr></thead>
            <tbody>{company.ubos.map((u, i) => <tr key={i} className="border-b border-slate-50"><td className="py-2 text-slate-700">{u.name}</td><td className="py-2 text-slate-700">{u.pct}%</td><td className="py-2 text-slate-700">{u.nationality}</td></tr>)}</tbody>
          </table>
        )}

        {tab === "Documents" && (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2 min-w-0"><FileText size={15} className="text-slate-400 shrink-0" /><div className="min-w-0"><div className="text-slate-800 truncate">{d.name}</div><div className="text-xs text-slate-400">{d.category} · uploaded {fmtDate(d.uploadDate)}</div></div></div>
                {d.expiryDate && <Badge tone={isOverdue(d.expiryDate) ? "rose" : isWithin(d.expiryDate, 60) ? "amber" : "slate"}>Expires {fmtDate(d.expiryDate)}</Badge>}
              </div>
            ))}
            {docs.length === 0 && <EmptyState icon={FileText} title="No documents yet" />}
          </div>
        )}

        {tab === "Compliance" && (
          <div className="space-y-2">
            {comp.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                <div><div className="font-medium text-slate-800">{c.title}</div><div className="text-xs text-slate-400">{c.type} · assigned to {c.assignedStaff}</div></div>
                <div className="text-right"><Badge tone={isOverdue(c.dueDate) ? "rose" : statusTone(c.status)}>{isOverdue(c.dueDate) ? "Overdue" : c.status}</Badge><div className="text-xs text-slate-400 mt-1">{fmtDate(c.dueDate)}</div></div>
              </div>
            ))}
            {comp.length === 0 && <EmptyState icon={ShieldCheck} title="No compliance items" />}
          </div>
        )}

        {tab === "Bank Accounts" && (
          <div className="space-y-2">
            {company.bankAccounts.map((b, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2"><Landmark size={15} className="text-slate-400" /><div><div className="text-slate-800 font-medium">{b.bank}</div><div className="text-xs text-slate-400">{b.iban} · {b.currency}</div></div></div>
                <Badge tone={statusTone(b.status)}>{b.status}</Badge>
              </div>
            ))}
          </div>
        )}

        {tab === "Payment Gateways" && (
          <div className="space-y-2">
            {company.paymentGateways.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2"><CreditCard size={15} className="text-slate-400" /><span className="text-slate-800 font-medium">{p.name}</span></div>
                <Badge tone={statusTone(p.status)}>{p.status}</Badge>
              </div>
            ))}
          </div>
        )}

        {tab === "Credentials" && (
          <div className="space-y-2">
            {data.credentials.filter((c) => c.companyId === company.id).map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2"><Lock size={15} className="text-slate-400" /><div><div className="text-slate-800 font-medium">{c.name}</div><div className="text-xs text-slate-400">{c.type} · {c.username}</div></div></div>
                <Badge tone={statusTone(c.status)}>{c.status}</Badge>
              </div>
            ))}
          </div>
        )}

        {tab === "Tasks" && (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                <div><div className="text-slate-800">{t.title}</div><div className="text-xs text-slate-400">{t.assignee} · due {fmtDate(t.dueDate)}</div></div>
                <Badge tone={statusTone(t.status)}>{t.status}</Badge>
              </div>
            ))}
            {tasks.length === 0 && <EmptyState icon={ListChecks} title="No tasks for this company" />}
          </div>
        )}

        {tab === "Notes" && (
          <div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap mb-3">{company.notes || "No notes yet."}</p>
            {!readOnly && (
              <div className="flex gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Append a note…" className={inputCls} />
                <button onClick={() => { if (!note.trim()) return; setData((d) => ({ ...d, companies: d.companies.map((c) => c.id === company.id ? { ...c, notes: (c.notes ? c.notes + "\n" : "") + note } : c) })); addActivity("Added note", company.name); setNote(""); }} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Save</button>
              </div>
            )}
          </div>
        )}

        {tab === "Activity" && (
          <div className="space-y-2">
            {data.activity.filter((a) => a.detail.includes(company.name)).map((a) => (
              <div key={a.id} className="flex justify-between text-sm border-b border-slate-50 py-2">
                <span className="text-slate-700">{a.user} · {a.action}</span><span className="text-xs text-slate-400">{relTime(a.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------ directors ---------------------------------- */

function AddDirectorModal({ onClose, onSave }) {
  const [f, setF] = useState({ fullName: "", nationality: "", dob: "", passport: "", address: "", email: "", phone: "", appointmentDate: "", status: "Active", notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Add Director" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-x-4 max-h-[65vh] overflow-y-auto pr-1">
        <Field label="Full Name"><input className={inputCls} value={f.fullName} onChange={set("fullName")} /></Field>
        <Field label="Nationality"><input className={inputCls} value={f.nationality} onChange={set("nationality")} /></Field>
        <Field label="Date of Birth"><input type="date" className={inputCls} value={f.dob} onChange={set("dob")} /></Field>
        <Field label="Passport Details"><input className={inputCls} value={f.passport} onChange={set("passport")} /></Field>
        <div className="col-span-2"><Field label="Residential Address"><input className={inputCls} value={f.address} onChange={set("address")} /></Field></div>
        <Field label="Email"><input className={inputCls} value={f.email} onChange={set("email")} /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Appointment Date"><input type="date" className={inputCls} value={f.appointmentDate} onChange={set("appointmentDate")} /></Field>
        <Field label="Status">
          <select className={inputCls} value={f.status} onChange={set("status")}><option>Active</option><option>Resigned</option></select>
        </Field>
        <div className="col-span-2"><Field label="Notes"><textarea className={inputCls} rows={2} value={f.notes} onChange={set("notes")} /></Field></div>
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={() => f.fullName && onSave({ ...f, id: uid("d"), companyIds: [] })} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Add Director</button>
      </div>
    </Modal>
  );
}

function DirectorsList({ data, go, setData, addActivity, readOnly }) {
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const filtered = data.directors.filter((d) => d.fullName.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search directors…" className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        {!readOnly && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3.5 py-2 rounded-lg hover:bg-indigo-700"><Plus size={15} /> Add Director</button>}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100">
            <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium hidden md:table-cell">Nationality</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">Linked Companies</th><th className="px-4 py-3 font-medium">Status</th>
          </tr></thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} onClick={() => go("directors", d.id)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-3"><div className="font-medium text-slate-800">{d.fullName}</div><div className="text-xs text-slate-400">{d.email}</div></td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-600">{d.nationality}</td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">{d.companyIds.map((cid) => { const c = data.companies.find((x) => x.id === cid); return c ? <JurBadge key={cid} jurisdiction={c.jurisdiction} /> : null; })}</div>
                </td>
                <td className="px-4 py-3"><Badge tone={statusTone(d.status)}>{d.status}</Badge></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4}><EmptyState icon={Users} title="No directors found" /></td></tr>}
          </tbody>
        </table>
      </div>
      {showAdd && <AddDirectorModal onClose={() => setShowAdd(false)} onSave={(dr) => { setData((d) => ({ ...d, directors: [dr, ...d.directors] })); addActivity("Added director", dr.fullName); setShowAdd(false); }} />}
    </div>
  );
}

function BulkLinkCompaniesModal({ director, companies, onClose, onSave }) {
  const [selected, setSelected] = useState(() => new Set(director.companyIds));
  const [query, setQuery] = useState("");
  const [jurFilter, setJurFilter] = useState("All");

  const filtered = companies.filter((c) =>
    (jurFilter === "All" || c.jurisdiction === jurFilter) &&
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const clearAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((c) => next.delete(c.id));
      return next;
    });
  };

  return (
    <Modal title={`Link companies to ${director.fullName}`} onClose={onClose} wide>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies…" className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <select value={jurFilter} onChange={(e) => setJurFilter(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-600">
          <option>All</option>
          {JURISDICTIONS.map((j) => <option key={j}>{j}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="text-slate-500">{selected.size} selected · {filtered.length} shown</span>
        <div className="flex gap-3">
          <button onClick={selectAllFiltered} className="text-indigo-600 hover:underline">Select all shown</button>
          <button onClick={clearAllFiltered} className="text-slate-400 hover:underline">Clear shown</button>
        </div>
      </div>
      <div className="border border-slate-100 rounded-lg max-h-80 overflow-y-auto divide-y divide-slate-50">
        {filtered.map((c) => (
          <label key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
            <div className="flex items-center gap-2 min-w-0">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="shrink-0" />
              <span className="text-sm text-slate-800 truncate">{c.name}</span>
            </div>
            <JurBadge jurisdiction={c.jurisdiction} />
          </label>
        ))}
        {filtered.length === 0 && <div className="p-4 text-sm text-slate-400 text-center">No companies match.</div>}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={() => onSave(Array.from(selected))} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
          Save Links ({selected.size})
        </button>
      </div>
    </Modal>
  );
}

function DirectorDetail({ director, data, go, setData, addActivity, readOnly }) {
  const companies = data.directors.find((d) => d.id === director.id)?.companyIds.map((cid) => data.companies.find((c) => c.id === cid)).filter(Boolean) || [];
  const [linkCompanyId, setLinkCompanyId] = useState("");
  const [showBulkLink, setShowBulkLink] = useState(false);
  const unlinkedCompanies = data.companies.filter((c) => !director.companyIds.includes(c.id));

  const linkCompany = (companyId) => {
    if (!companyId) return;
    setData((d) => ({
      ...d,
      directors: d.directors.map((dir) => dir.id === director.id ? { ...dir, companyIds: [...dir.companyIds, companyId] } : dir),
      companies: d.companies.map((c) => c.id === companyId ? { ...c, directorIds: [...c.directorIds, director.id] } : c),
    }));
    const coName = data.companies.find((c) => c.id === companyId)?.name;
    addActivity("Linked director", `${director.fullName} to ${coName}`);
    setLinkCompanyId("");
  };

  const unlinkCompany = (companyId) => {
    setData((d) => ({
      ...d,
      directors: d.directors.map((dir) => dir.id === director.id ? { ...dir, companyIds: dir.companyIds.filter((id) => id !== companyId) } : dir),
      companies: d.companies.map((c) => c.id === companyId ? { ...c, directorIds: c.directorIds.filter((id) => id !== director.id) } : c),
    }));
    const coName = data.companies.find((c) => c.id === companyId)?.name;
    addActivity("Unlinked director", `${director.fullName} from ${coName}`);
  };

  const saveBulkLinks = (selectedIds) => {
    const selectedSet = new Set(selectedIds);
    const before = new Set(director.companyIds);
    const added = selectedIds.filter((id) => !before.has(id)).length;
    const removed = director.companyIds.filter((id) => !selectedSet.has(id)).length;

    setData((d) => ({
      ...d,
      directors: d.directors.map((dir) => dir.id === director.id ? { ...dir, companyIds: selectedIds } : dir),
      companies: d.companies.map((c) => {
        const shouldHave = selectedSet.has(c.id);
        const currentlyHas = c.directorIds.includes(director.id);
        if (shouldHave && !currentlyHas) return { ...c, directorIds: [...c.directorIds, director.id] };
        if (!shouldHave && currentlyHas) return { ...c, directorIds: c.directorIds.filter((id) => id !== director.id) };
        return c;
      }),
    }));
    addActivity("Bulk-linked director", `${director.fullName}: +${added} / -${removed} companies`);
    setShowBulkLink(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <button onClick={() => go("directors")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> Back to Directors</button>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 flex-wrap mb-1"><h2 className="text-lg font-semibold text-slate-900">{director.fullName}</h2><Badge tone={statusTone(director.status)}>{director.status}</Badge></div>
        <div className="text-sm text-slate-500 mb-4">{director.nationality} · Appointed {fmtDate(director.appointmentDate)}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {[["Date of Birth", fmtDate(director.dob)], ["Passport", director.passport], ["Email", director.email], ["Phone", director.phone], ["Residential Address", director.address]].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-slate-50 py-2"><span className="text-slate-400">{k}</span><span className="text-slate-700 font-medium text-right">{v}</span></div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="font-semibold text-slate-800 text-sm mb-3 flex items-center justify-between">
          <span>Linked Companies</span>
          {!readOnly && (
            <button onClick={() => setShowBulkLink(true)} className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
              <Plus size={13} /> Link Multiple Companies
            </button>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-2 mb-4">
            <select value={linkCompanyId} onChange={(e) => setLinkCompanyId(e.target.value)} className={inputCls}>
              <option value="">Or quickly link just one…</option>
              {unlinkedCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => linkCompany(linkCompanyId)} disabled={!linkCompanyId} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 whitespace-nowrap">Link</button>
          </div>
        )}
        <div className="space-y-2">
          {companies.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
              <div onClick={() => go("companies", c.id)} className="flex items-center gap-2 cursor-pointer hover:opacity-70 flex-1">
                <Building2 size={15} className="text-slate-400" /><span className="font-medium text-slate-800">{c.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <JurBadge jurisdiction={c.jurisdiction} />
                {!readOnly && <button onClick={() => unlinkCompany(c.id)} className="text-xs text-slate-400 hover:text-rose-600 px-1">Unlink</button>}
              </div>
            </div>
          ))}
          {companies.length === 0 && <EmptyState icon={Building2} title="Not linked to any company" sub="Use the dropdown above to link one." />}
        </div>
      </div>
      {director.notes && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="font-semibold text-slate-800 text-sm mb-2">Notes</div>
          <p className="text-sm text-slate-600">{director.notes}</p>
        </div>
      )}
      {showBulkLink && (
        <BulkLinkCompaniesModal director={director} companies={data.companies} onClose={() => setShowBulkLink(false)} onSave={saveBulkLinks} />
      )}
    </div>
  );
}

/* ------------------------------------ documents ---------------------------------- */

function Documents({ data, setData, addActivity, readOnly }) {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const filtered = data.documents.filter((d) => (cat === "All" || d.category === cat) && d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-600">
            <option>All</option>{DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {!readOnly && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3.5 py-2 rounded-lg hover:bg-indigo-700"><Plus size={15} /> Upload Document</button>}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100">
            <th className="px-4 py-3 font-medium">Document</th><th className="px-4 py-3 font-medium hidden md:table-cell">Category</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">Company</th><th className="px-4 py-3 font-medium hidden lg:table-cell">Uploaded</th><th className="px-4 py-3 font-medium">Expiry</th>
          </tr></thead>
          <tbody>
            {filtered.map((d) => {
              const co = data.companies.find((c) => c.id === d.companyId);
              return (
                <tr key={d.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><FileText size={15} className="text-slate-400" /><div><div className="font-medium text-slate-800">{d.name}</div><div className="text-xs text-slate-400">Uploaded by {d.uploader}</div></div></div></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Badge>{d.category}</Badge></td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{co?.name}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{fmtDate(d.uploadDate)}</td>
                  <td className="px-4 py-3">{d.expiryDate ? <Badge tone={isOverdue(d.expiryDate) ? "rose" : isWithin(d.expiryDate, 60) ? "amber" : "slate"}>{fmtDate(d.expiryDate)}</Badge> : <span className="text-slate-300 text-xs">—</span>}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={5}><EmptyState icon={FileText} title="No documents found" /></td></tr>}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <Modal title="Upload Document" onClose={() => setShowAdd(false)}>
          <AddDocForm companies={data.companies} onCancel={() => setShowAdd(false)} onSave={(doc) => { setData((d) => ({ ...d, documents: [doc, ...d.documents] })); addActivity("Uploaded document", doc.name); setShowAdd(false); }} />
        </Modal>
      )}
    </div>
  );
}

function AddDocForm({ companies, onSave, onCancel }) {
  const [f, setF] = useState({ name: "", category: DOC_CATEGORIES[0], companyId: companies[0]?.id || "", expiryDate: "", uploader: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <Field label="File Name"><input className={inputCls} placeholder="e.g. Certificate of Incorporation.pdf" value={f.name} onChange={set("name")} /></Field>
      <Field label="Category"><select className={inputCls} value={f.category} onChange={set("category")}>{DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Company"><select className={inputCls} value={f.companyId} onChange={set("companyId")}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Expiry Date (optional)"><input type="date" className={inputCls} value={f.expiryDate} onChange={set("expiryDate")} /></Field>
      <Field label="Uploader"><input className={inputCls} value={f.uploader} onChange={set("uploader")} /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={() => f.name && onSave({ ...f, id: uid("doc"), uploadDate: "2026-07-29", expiryDate: f.expiryDate || null })} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
      </div>
    </div>
  );
}

/* ------------------------------------ credentials ---------------------------------- */

function Credentials({ data, setData, addActivity, readOnly }) {
  const [reveal, setReveal] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 flex items-center gap-1.5"><Lock size={14} /> Credentials are masked by default. Only Super Admin and Admin roles can reveal secrets.</p>
        {!readOnly && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3.5 py-2 rounded-lg hover:bg-indigo-700"><Plus size={15} /> Add Credential</button>}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100">
            <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium hidden md:table-cell">Type</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">Company</th><th className="px-4 py-3 font-medium">Secret</th><th className="px-4 py-3 font-medium">Status</th>
          </tr></thead>
          <tbody>
            {data.credentials.map((c) => {
              const co = data.companies.find((x) => x.id === c.companyId);
              return (
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3"><div className="font-medium text-slate-800">{c.name}</div><div className="text-xs text-slate-400">{c.username}</div></td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-600">{c.type}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{co?.name}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setReveal((r) => ({ ...r, [c.id]: !r[c.id] }))} className="flex items-center gap-1.5 text-slate-600 font-mono text-xs">
                      {reveal[c.id] ? c.secret : "••••••••••"} {reveal[c.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </td>
                  <td className="px-4 py-3"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <Modal title="Add Credential" onClose={() => setShowAdd(false)}>
          <AddCredentialForm companies={data.companies} onCancel={() => setShowAdd(false)} onSave={(cr) => { setData((d) => ({ ...d, credentials: [cr, ...d.credentials] })); addActivity("Added credential", cr.name); setShowAdd(false); }} />
        </Modal>
      )}
    </div>
  );
}

function AddCredentialForm({ companies, onSave, onCancel }) {
  const [f, setF] = useState({ type: "Bank", name: "", companyId: companies[0]?.id || "", username: "", secret: "", status: "Active", notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <Field label="Type"><select className={inputCls} value={f.type} onChange={set("type")}><option>Bank</option><option>Payment Gateway</option><option>API Key</option><option>Portal Login</option></select></Field>
      <Field label="Name"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
      <Field label="Company"><select className={inputCls} value={f.companyId} onChange={set("companyId")}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Username"><input className={inputCls} value={f.username} onChange={set("username")} /></Field>
      <Field label="Secret / Password / API Key"><input className={inputCls} value={f.secret} onChange={set("secret")} /></Field>
      <Field label="Status"><select className={inputCls} value={f.status} onChange={set("status")}><option>Active</option><option>Pending</option><option>Suspended</option></select></Field>
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={() => f.name && onSave({ ...f, id: uid("cr") })} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
      </div>
    </div>
  );
}

/* ------------------------------------ compliance ---------------------------------- */

function Compliance({ data, setData, addActivity, readOnly }) {
  const [status, setStatus] = useState("All");
  const [jur, setJur] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const rows = data.compliance
    .map((c) => ({ ...c, company: data.companies.find((x) => x.id === c.companyId) }))
    .filter((c) => (jur === "All" || c.company?.jurisdiction === jur))
    .filter((c) => (status === "All" || (status === "Overdue" ? isOverdue(c.dueDate) : c.status === status)))
    .sort((a, b) => parseDate(a.dueDate) - parseDate(b.dueDate));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={jur} onChange={(e) => setJur(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-600"><option>All</option>{JURISDICTIONS.map((j) => <option key={j}>{j}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-600">
            <option>All</option><option>Not Started</option><option>Pending</option><option>Completed</option><option>Overdue</option>
          </select>
        </div>
        {!readOnly && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3.5 py-2 rounded-lg hover:bg-indigo-700"><Plus size={15} /> Add Filing</button>}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100">
            <th className="px-4 py-3 font-medium">Filing</th><th className="px-4 py-3 font-medium hidden md:table-cell">Company</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">Assigned</th><th className="px-4 py-3 font-medium">Priority</th>
            <th className="px-4 py-3 font-medium">Due</th><th className="px-4 py-3 font-medium">Status</th>
          </tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-medium text-slate-800">{c.title}</div><div className="text-xs text-slate-400">{c.type}</div></td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-600">{c.company?.name}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{c.assignedStaff}</td>
                <td className="px-4 py-3"><Badge tone={c.priority === "High" ? "rose" : c.priority === "Medium" ? "amber" : "slate"}>{c.priority}</Badge></td>
                <td className="px-4 py-3 text-slate-600">{fmtDate(c.dueDate)}</td>
                <td className="px-4 py-3"><Badge tone={isOverdue(c.dueDate) ? "rose" : statusTone(c.status)}>{isOverdue(c.dueDate) ? "Overdue" : c.status}</Badge></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6}><EmptyState icon={ShieldCheck} title="No filings match these filters" /></td></tr>}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <Modal title="Add Compliance Filing" onClose={() => setShowAdd(false)}>
          <AddComplianceForm companies={data.companies} onCancel={() => setShowAdd(false)} onSave={(cp) => { setData((d) => ({ ...d, compliance: [cp, ...d.compliance] })); addActivity("Created compliance item", cp.title); setShowAdd(false); }} />
        </Modal>
      )}
    </div>
  );
}

function AddComplianceForm({ companies, onSave, onCancel }) {
  const [f, setF] = useState({ companyId: companies[0]?.id || "", type: COMPLIANCE_TYPES[0], title: "", dueDate: "", priority: "Medium", assignedStaff: "", notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <Field label="Company"><select className={inputCls} value={f.companyId} onChange={set("companyId")}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Filing Type"><select className={inputCls} value={f.type} onChange={set("type")}>{COMPLIANCE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
      <Field label="Title"><input className={inputCls} value={f.title} onChange={set("title")} /></Field>
      <Field label="Due Date"><input type="date" className={inputCls} value={f.dueDate} onChange={set("dueDate")} /></Field>
      <Field label="Priority"><select className={inputCls} value={f.priority} onChange={set("priority")}><option>High</option><option>Medium</option><option>Low</option></select></Field>
      <Field label="Assigned Staff"><input className={inputCls} value={f.assignedStaff} onChange={set("assignedStaff")} /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={() => f.title && f.dueDate && onSave({ ...f, id: uid("cp"), status: "Not Started", reminder: true })} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
      </div>
    </div>
  );
}

/* ------------------------------------ tasks ---------------------------------- */

function Tasks({ data, setData, addActivity, readOnly }) {
  const [showAdd, setShowAdd] = useState(false);
  const cols = ["To Do", "In Progress", "Done"];
  const move = (id, status) => { setData((d) => ({ ...d, tasks: d.tasks.map((t) => t.id === id ? { ...t, status } : t) })); addActivity("Updated task status", status); };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex justify-end">
        {!readOnly && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3.5 py-2 rounded-lg hover:bg-indigo-700"><Plus size={15} /> Add Task</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cols.map((col) => (
          <div key={col} className="bg-slate-50 rounded-xl p-3">
            <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center justify-between">{col} <span className="text-xs text-slate-400">{data.tasks.filter((t) => t.status === col).length}</span></div>
            <div className="space-y-2">
              {data.tasks.filter((t) => t.status === col).map((t) => {
                const co = data.companies.find((c) => c.id === t.companyId);
                return (
                  <div key={t.id} className="bg-white rounded-lg border border-slate-200 p-3">
                    <div className="text-sm text-slate-800 mb-1.5">{t.title}</div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span>{co?.name}</span><Badge tone={t.priority === "High" ? "rose" : t.priority === "Medium" ? "amber" : "slate"}>{t.priority}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{t.assignee} · {fmtDate(t.dueDate)}</span>
                      {!readOnly && (
                        <select value={t.status} onChange={(e) => move(t.id, e.target.value)} className="text-xs border border-slate-200 rounded px-1 py-0.5">
                          {cols.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
              {data.tasks.filter((t) => t.status === col).length === 0 && <div className="text-xs text-slate-400 text-center py-6">No tasks</div>}
            </div>
          </div>
        ))}
      </div>
      {showAdd && (
        <Modal title="Add Task" onClose={() => setShowAdd(false)}>
          <AddTaskForm companies={data.companies} onCancel={() => setShowAdd(false)} onSave={(t) => { setData((d) => ({ ...d, tasks: [t, ...d.tasks] })); addActivity("Created task", t.title); setShowAdd(false); }} />
        </Modal>
      )}
    </div>
  );
}

function AddTaskForm({ companies, onSave, onCancel }) {
  const [f, setF] = useState({ title: "", companyId: companies[0]?.id || "", assignee: "", dueDate: "", priority: "Medium", status: "To Do" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <Field label="Task"><input className={inputCls} value={f.title} onChange={set("title")} /></Field>
      <Field label="Company"><select className={inputCls} value={f.companyId} onChange={set("companyId")}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Assignee"><input className={inputCls} value={f.assignee} onChange={set("assignee")} /></Field>
      <Field label="Due Date"><input type="date" className={inputCls} value={f.dueDate} onChange={set("dueDate")} /></Field>
      <Field label="Priority"><select className={inputCls} value={f.priority} onChange={set("priority")}><option>High</option><option>Medium</option><option>Low</option></select></Field>
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
        <button onClick={() => f.title && onSave({ ...f, id: uid("tk") })} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
      </div>
    </div>
  );
}

/* ------------------------------------ AI assistant ---------------------------------- */

function AIAssistant({ data }) {
  const [messages, setMessages] = useState([{ role: "assistant", text: "Hi, I'm your compliance assistant. Ask me about upcoming deadlines, company status, or anything in your entity portfolio." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const contextSummary = useMemo(() => {
    const overdue = data.compliance.filter((c) => isOverdue(c.dueDate));
    const upcoming = data.compliance.filter((c) => isWithin(c.dueDate, 30));
    return `You are an assistant embedded in "Global Entity Manager", a corporate entity compliance platform. Today's date is 29 July 2026. Answer questions using this portfolio data, be concise, and use plain text (no markdown tables).
Companies (${data.companies.length}): ${data.companies.map((c) => `${c.name} [${c.jurisdiction}, ${c.status}, renewal ${c.renewalDate}, tax due ${c.taxDueDate}]`).join("; ")}.
Directors (${data.directors.length}): ${data.directors.map((d) => `${d.fullName} (${d.nationality}, ${d.status})`).join("; ")}.
Overdue filings (${overdue.length}): ${overdue.map((c) => c.title).join("; ") || "none"}.
Filings due in next 30 days (${upcoming.length}): ${upcoming.map((c) => `${c.title} due ${c.dueDate}`).join("; ") || "none"}.
Pending KYC: ${data.kycQueue.length}. Pending bank/payment applications: ${data.applicationQueue.length}.`;
  }, [data]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", text: input };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/.netlify/functions/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: contextSummary, question: userMsg.text }),
      });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || "Request failed");
      const text = responseData.text || "I couldn't generate a response just now.";
      setMessages((m) => [...m, { role: "assistant", text }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: "I couldn't reach the assistant just now. If this keeps happening, check that ANTHROPIC_API_KEY is set in your Netlify environment variables." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-64px)] flex flex-col">
      <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                {m.role === "assistant" && i === 0 && <Sparkles size={14} className="inline mr-1.5 -mt-0.5 text-indigo-500" />}
                <span className="whitespace-pre-wrap">{m.text}</span>
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-slate-400 px-1">Thinking…</div>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-slate-100 p-3 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about deadlines, companies, directors…" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <button onClick={send} disabled={loading} className="bg-indigo-600 text-white rounded-lg px-3.5 py-2 hover:bg-indigo-700 disabled:opacity-50"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------ settings ---------------------------------- */

function SettingsPage({ role, setRole }) {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="font-semibold text-slate-800 mb-1">Current Role</div>
        <div className="text-sm text-slate-500 mb-3">Switch roles to preview how access changes across the platform. Read Only disables all add, edit and delete actions.</div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls + " max-w-xs"}>
          {ROLES.map((r) => <option key={r.name}>{r.name}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="font-semibold text-slate-800 mb-3">Roles & Access</div>
        <div className="space-y-3">
          {ROLES.map((r) => (
            <div key={r.name} className="flex items-start justify-between border-b border-slate-50 last:border-0 pb-3 last:pb-0">
              <div><div className="text-sm font-medium text-slate-800">{r.name}</div><div className="text-xs text-slate-400 mt-0.5 max-w-sm">{r.desc}</div></div>
              {role === r.name && <Badge tone="emerald">Active</Badge>}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="font-semibold text-slate-800 mb-1">Activity Log</div>
        <div className="text-sm text-slate-500">Every create, update and status change across companies, directors, documents, credentials and filings is timestamped and attributed to a user. View the full trail on the Dashboard and inside each company's Activity tab.</div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="font-semibold text-slate-800 mb-1">Built for what's next</div>
        <div className="text-sm text-slate-500">This workspace is structured so companies, directors and filings can scale to thousands of records, with the AI Assistant, API access and workflow automation designed as first-class extensions rather than bolt-ons.</div>
      </div>
    </div>
  );
}

/* ------------------------------------ auth / login ---------------------------------- */

function LoginScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Account created. If email confirmation is enabled on this project, check your inbox before signing in.");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">G</div>
          <span className="font-semibold text-slate-900">Global Entity Manager</span>
        </div>
        <p className="text-sm text-slate-500 mb-5">{mode === "signin" ? "Sign in to your workspace." : "Create a workspace account."}</p>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Email">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls + " pl-9"} placeholder="you@company.com" />
            </div>
          </Field>
          <Field label="Password">
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
          </Field>
          {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
          {info && <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{info}</div>}
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
        <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }} className="w-full text-center text-xs text-slate-500 hover:text-slate-700 mt-4">
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------ app root ---------------------------------- */

function Workspace({ session }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedDirectorId, setSelectedDirectorId] = useState(null);
  const [role, setRole] = useState("Super Admin");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const skipNextSave = useRef(false);

  // Load the shared record from Supabase on first mount. If it doesn't exist yet, create it.
  useEffect(() => {
    (async () => {
      try {
        const { data: row, error } = await supabase.from("gem_data").select("data").eq("id", 1).maybeSingle();
        if (error) throw error;
        if (row && row.data) {
          setData(row.data);
        } else {
          const seeded = seedData();
          const { error: insertError } = await supabase.from("gem_data").upsert({ id: 1, data: seeded });
          if (insertError) throw insertError;
          setData(seeded);
        }
      } catch (e) {
        console.error("Supabase load failed:", e);
        setSaveError(true);
        setData(seedData());
      }
    })();
  }, []);

  // Persist every change back to Supabase so it's visible to everyone else with the link.
  useEffect(() => {
    if (!data) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    (async () => {
      try {
        const { error } = await supabase.from("gem_data").upsert({ id: 1, data });
        if (error) throw error;
        setSaveError(false);
      } catch (e) {
        console.error("Supabase save failed:", e);
        setSaveError(true);
      }
    })();
  }, [data]);

  // Live sync: if someone else edits the data, pick up their change without a refresh.
  useEffect(() => {
    const channel = supabase
      .channel("gem_data_changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "gem_data", filter: "id=eq.1" }, (payload) => {
        if (payload.new && payload.new.data) {
          skipNextSave.current = true;
          setData(payload.new.data);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const addActivity = (action, detail) => {
    setData((d) => ({ ...d, activity: [{ id: uid("ac"), ts: new Date().toISOString(), user: session?.user?.email || "User", action, detail }, ...d.activity].slice(0, 40) }));
  };

  const go = (target, id) => {
    setPage(target);
    if (target === "companies") setSelectedCompanyId(id || null);
    if (target === "directors") setSelectedDirectorId(id || null);
  };

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading Global Entity Manager…</div>;
  }

  const readOnly = role === "Read Only" || role === "Client Portal";
  const titles = { dashboard: "Dashboard", companies: "Companies", directors: "Directors", documents: "Documents", credentials: "Credentials", compliance: "Annual Compliance", tasks: "Tasks", ai: "AI Assistant", settings: "Settings" };

  let body;
  if (page === "dashboard") body = <Dashboard data={data} go={go} />;
  else if (page === "companies") {
    const co = selectedCompanyId ? data.companies.find((c) => c.id === selectedCompanyId) : null;
    body = co ? <CompanyDetail company={co} data={data} setData={setData} go={go} addActivity={addActivity} readOnly={readOnly} /> : <CompaniesList data={data} go={go} setData={setData} addActivity={addActivity} readOnly={readOnly} />;
  } else if (page === "directors") {
    const dr = selectedDirectorId ? data.directors.find((d) => d.id === selectedDirectorId) : null;
    body = dr ? <DirectorDetail director={dr} data={data} go={go} setData={setData} addActivity={addActivity} readOnly={readOnly} /> : <DirectorsList data={data} go={go} setData={setData} addActivity={addActivity} readOnly={readOnly} />;
  } else if (page === "documents") body = <Documents data={data} setData={setData} addActivity={addActivity} readOnly={readOnly} />;
  else if (page === "credentials") body = <Credentials data={data} setData={setData} addActivity={addActivity} readOnly={readOnly} />;
  else if (page === "compliance") body = <Compliance data={data} setData={setData} addActivity={addActivity} readOnly={readOnly} />;
  else if (page === "tasks") body = <Tasks data={data} setData={setData} addActivity={addActivity} readOnly={readOnly} />;
  else if (page === "ai") body = <AIAssistant data={data} />;
  else if (page === "settings") body = <SettingsPage role={role} setRole={setRole} />;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans" style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <Sidebar page={page} go={go} role={role} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}
        userEmail={session?.user?.email} onSignOut={() => supabase.auth.signOut()} />
      <div className="flex-1 min-w-0">
        <TopBar title={titles[page]} data={data} go={go} setMobileOpen={setMobileOpen} />
        {body}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading…</div>;
  }
  if (!session) {
    return <LoginScreen />;
  }
  return <Workspace session={session} />;
}
