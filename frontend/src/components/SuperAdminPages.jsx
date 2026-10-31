import {
  Activity,
  Building2,
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { superAdminApi } from "../lib/api";
import { WorkflowHeader } from "./WorkflowPrimitives";

const SUBSCRIPTION_PLANS = ["STARTER", "GROWTH", "ENTERPRISE", "CUSTOM"];
const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"];
const SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];
const PLAN_DEFAULT_PRICING = {
  STARTER: 1499,
  GROWTH: 3499,
  ENTERPRISE: 8999,
  CUSTOM: 0
};
const CLIENT_TYPE_OPTIONS = [
  {
    value: "SOCIETY",
    label: "Society",
    description: "Resident, flat, tower, and guard workflows."
  },
  {
    value: "CORPORATE",
    label: "Corporate",
    description: "Office, workplace unit, and guard workflows."
  }
];

const getClientTypeLabel = (clientType) => (clientType === "CORPORATE" ? "Corporate" : "Society");

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function formatDate(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMoney(amount, currency = "INR") {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${formatNumber(value)}`;
  }
}

const compactPayload = (payload) =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined && value !== null));

function useSocieties(token) {
  const [societies, setSocieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!token) return;
    try {
      setError("");
      const data = await superAdminApi.societies(token);
      setSocieties(data.societies || []);
    } catch (err) {
      setError(err.message || "Unable to load societies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  return { societies, loading, error, reload: load };
}

function buildOnboardingTrend(societies = []) {
  const now = new Date();
  const months = [];

  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-IN", { month: "short" });
    months.push({ key, label, count: 0 });
  }

  societies.forEach((item) => {
    if (!item.createdAt) return;
    const createdAt = new Date(item.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`;
    const bucket = months.find((month) => month.key === key);
    if (bucket) bucket.count += 1;
  });

  return months;
}

function getSocietyTier(society) {
  if ((society.flats || 0) >= 150 || (society.visitors || 0) >= 1000) {
    return { label: "Enterprise", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
  }
  if ((society.flats || 0) >= 50 || (society.visitors || 0) >= 250) {
    return { label: "Growth", className: "bg-blue-50 text-blue-700 ring-blue-200" };
  }
  return { label: "Starter", className: "bg-slate-100 text-slate-700 ring-slate-200" };
}

function StatusBadge({ isActive }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
        isActive ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function SubscriptionBadge({ status }) {
  const key = String(status || "ACTIVE").toUpperCase();
  const map = {
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    TRIAL: "bg-blue-50 text-blue-700 ring-blue-200",
    SUSPENDED: "bg-amber-50 text-amber-700 ring-amber-200",
    CANCELLED: "bg-red-50 text-red-700 ring-red-200",
    EXPIRED: "bg-rose-50 text-rose-700 ring-rose-200"
  };
  const tone = map[key] || "bg-slate-100 text-slate-700 ring-slate-200";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${tone}`}>{key}</span>;
}

function SuperKpiCards({ societies }) {
  const stats = [
    {
      label: "Client Accounts",
      value: societies.length,
      hint: "Total onboarded companies",
      Icon: Building2,
      tone: "bg-blue-50 text-blue-700"
    },
    {
      label: "Active Admins",
      value: societies.filter((item) => item.admin).length,
      hint: "Clients with admin ownership",
      Icon: UsersRound,
      tone: "bg-blue-50 text-blue-700"
    },
    {
      label: "Portfolio Units",
      value: societies.reduce((sum, item) => sum + (item.flats || 0), 0),
      hint: "All registered flats/offices",
      Icon: Crown,
      tone: "bg-indigo-50 text-indigo-700"
    },
    {
      label: "Platform Visitors",
      value: societies.reduce((sum, item) => sum + (item.visitors || 0), 0),
      hint: "Cumulative traffic footprint",
      Icon: Activity,
      tone: "bg-emerald-50 text-emerald-700"
    }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((card) => (
        <article key={card.label} className="panel rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600">{card.label}</p>
            <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ring-black/5 ${card.tone}`}>
              <card.Icon size={18} />
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-950 tabular-nums">{formatNumber(card.value)}</p>
          <p className="mt-1.5 text-xs font-semibold text-slate-500">{card.hint}</p>
        </article>
      ))}
    </div>
  );
}

function SuperTrendPanel({ societies }) {
  const trend = buildOnboardingTrend(societies);
  const max = Math.max(...trend.map((item) => item.count), 1);

  return (
    <section className="panel rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-bold text-slate-950">Client Onboarding Momentum</h4>
          <p className="mt-0.5 text-sm text-slate-500">Last 6 months onboarding velocity.</p>
        </div>
        <span className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">Rolling 6M</span>
      </div>

      <div className="space-y-3">
        {trend.map((item) => (
          <div key={item.key} className="grid grid-cols-[46px_1fr_38px] items-center gap-3">
            <p className="text-xs font-semibold text-slate-500">{item.label}</p>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                style={{ width: `${Math.max((item.count / max) * 100, item.count > 0 ? 14 : 0)}%` }}
              />
            </div>
            <p className="text-right text-xs font-bold text-slate-700 tabular-nums">{item.count}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SuperTopClients({ societies }) {
  const ranked = [...societies].sort((a, b) => (b.visitors || 0) - (a.visitors || 0)).slice(0, 6);

  return (
    <section className="panel rounded-2xl p-6">
      <div className="mb-4">
        <h4 className="text-base font-bold text-slate-950">Top Client Activity</h4>
        <p className="mt-0.5 text-sm text-slate-500">Highest visitor traffic across active clients.</p>
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-slate-500">No societies onboarded yet.</p>
      ) : (
        <div className="space-y-3">
          {ranked.map((society) => (
            <div key={society.id} className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{society.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{society.admin?.name || "No admin assigned"}</p>
                </div>
                <StatusBadge isActive={society.isActive} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200">Visitors: {formatNumber(society.visitors)}</span>
                <span className="rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200">{society.clientType === "CORPORATE" ? "Offices" : "Flats"}: {formatNumber(society.flats)}</span>
                <span className="rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200">Gates: {formatNumber(society.gates)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SubscriptionEditor({ token, client, onClose, onSaved }) {
  const current = client?.subscription || {};
  const [form, setForm] = useState({
    plan: current.plan || "STARTER",
    billingCycle: current.billingCycle || "MONTHLY",
    status: current.status || "ACTIVE",
    amount: current.amount ?? PLAN_DEFAULT_PRICING[current.plan || "STARTER"] ?? 0,
    currency: current.currency || "INR",
    startsAt: current.startsAt ? String(current.startsAt).slice(0, 10) : "",
    expiresAt: current.expiresAt ? String(current.expiresAt).slice(0, 10) : "",
    notes: current.notes || "",
    isActive: client?.isActive !== false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const updatePlan = (value) =>
    setForm((prev) => ({
      ...prev,
      plan: value,
      amount: PLAN_DEFAULT_PRICING[value] ?? prev.amount
    }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await superAdminApi.updateSocietySubscription(token, client.id, compactPayload({
        plan: form.plan,
        billingCycle: form.billingCycle,
        status: form.status,
        amount: Number(form.amount || 0),
        currency: form.currency,
        startsAt: form.startsAt,
        expiresAt: form.expiresAt,
        notes: form.notes,
        isActive: form.isActive
      }));
      setStatus("Subscription updated successfully.");
      onSaved?.();
    } catch (err) {
      setError(err.message || "Unable to update subscription");
    } finally {
      setSaving(false);
    }
  };

  const runQuickAction = async (quickAction, successMessage) => {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await superAdminApi.updateSocietySubscription(token, client.id, { quickAction, isActive: quickAction !== "SUSPEND_SERVICE" });
      setStatus(successMessage);
      onSaved?.();
    } catch (err) {
      setError(err.message || "Unable to update service access");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Subscription Controls</p>
          <p className="text-xs text-slate-500">{client.name}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
          Close
        </button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <button
          type="button"
          disabled={saving}
          onClick={() => runQuickAction("ACTIVATE_DEMO", "10-day demo activated.")}
          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-60"
        >
          Enable 10-day Demo
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => runQuickAction("RESUME_SERVICE", "Client shifted from demo to paid subscription.")}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-60"
        >
          Shift to Subscription
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => runQuickAction("SUSPEND_SERVICE", "Service stopped for this client.")}
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-60"
        >
          Stop Service
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => runQuickAction("RESUME_SERVICE", "Service resumed for this client.")}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-60"
        >
          Resume Paid Service
        </button>
      </div>

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-xs font-semibold text-slate-600">Plan</span>
          <select value={form.plan} onChange={(e) => updatePlan(e.target.value)} className="field-glass mt-1 h-10 w-full rounded-xl px-3 text-sm">
            {SUBSCRIPTION_PLANS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span className="text-xs font-semibold text-slate-600">Billing cycle</span>
          <select value={form.billingCycle} onChange={(e) => update("billingCycle", e.target.value)} className="field-glass mt-1 h-10 w-full rounded-xl px-3 text-sm">
            {BILLING_CYCLES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span className="text-xs font-semibold text-slate-600">Subscription status</span>
          <select value={form.status} onChange={(e) => update("status", e.target.value)} className="field-glass mt-1 h-10 w-full rounded-xl px-3 text-sm">
            {SUBSCRIPTION_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span className="text-xs font-semibold text-slate-600">Account access</span>
          <select value={form.isActive ? "ACTIVE" : "INACTIVE"} onChange={(e) => update("isActive", e.target.value === "ACTIVE")} className="field-glass mt-1 h-10 w-full rounded-xl px-3 text-sm">
            <option value="ACTIVE">Active login access</option>
            <option value="INACTIVE">Inactive login access</option>
          </select>
        </label>

        <label>
          <span className="text-xs font-semibold text-slate-600">Plan amount</span>
          <input type="number" min="0" value={form.amount} onChange={(e) => update("amount", e.target.value)} className="field-glass mt-1 h-10 w-full rounded-xl px-3 text-sm" />
        </label>

        <label>
          <span className="text-xs font-semibold text-slate-600">Currency</span>
          <select value={form.currency} onChange={(e) => update("currency", e.target.value)} className="field-glass mt-1 h-10 w-full rounded-xl px-3 text-sm">
            {CURRENCIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span className="text-xs font-semibold text-slate-600">Starts on</span>
          <input type="date" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} className="field-glass mt-1 h-10 w-full rounded-xl px-3 text-sm" />
        </label>

        <label>
          <span className="text-xs font-semibold text-slate-600">Expires on</span>
          <input type="date" value={form.expiresAt} onChange={(e) => update("expiresAt", e.target.value)} className="field-glass mt-1 h-10 w-full rounded-xl px-3 text-sm" />
        </label>

        <label className="sm:col-span-2">
          <span className="text-xs font-semibold text-slate-600">Notes</span>
          <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className="field-glass mt-1 w-full rounded-xl px-3 py-2 text-sm" placeholder="Optional billing/support notes" />
        </label>

        {status ? <p className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">{status}</p> : null}
        {error ? <p className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

        <div className="sm:col-span-2">
          <button disabled={saving} type="submit" className="inline-flex h-10 items-center rounded-xl bg-blue-700 px-4 text-xs font-bold text-white disabled:opacity-60">
            {saving ? "Saving..." : "Save Subscription"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function SuperDashboard({ session }) {
  const { societies, loading, error, reload } = useSocieties(session.accessToken);

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Super Admin"
        title="SaaS Command Center"
        description="Track platform client growth, onboarding momentum, activity health, and admin readiness from one executive dashboard."
        stats={[
          { label: "Clients", value: formatNumber(societies.length) },
          { label: "Active", value: formatNumber(societies.filter((item) => item.isActive).length) },
          { label: "Admins", value: formatNumber(societies.filter((item) => item.admin).length) }
        ]}
      />

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Loading dashboard metrics...</p> : null}

      <SuperKpiCards societies={societies} />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <SuperTrendPanel societies={societies} />
        <SuperTopClients societies={societies} />
      </section>

      <SocietyClients session={session} societies={societies} loading={loading} error={error} embedded onSubscriptionUpdated={reload} />
    </section>
  );
}

export function OnboardSociety({ session }) {
  const [form, setForm] = useState({
    clientType: "SOCIETY",
    societyName: "",
    adminName: "",
    adminEmail: "",
    adminPhone: "",
    adminPassword: "",
    address: "",
    demoEnabled: false
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const update = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await superAdminApi.onboardSociety(session.accessToken, form);
      setStatus(`${getClientTypeLabel(form.clientType)} admin login created successfully.`);
      setForm({
        clientType: "SOCIETY",
        societyName: "",
        adminName: "",
        adminEmail: "",
        adminPhone: "",
        adminPassword: "",
        address: "",
        demoEnabled: false
      });
    } catch (err) {
      setError(err.message || "Unable to create client login");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <form onSubmit={submit} className="panel rounded-2xl p-6 sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <KeyRound size={22} />
          </span>
          <div>
            <h3 className="text-xl font-bold text-slate-950">Create Client Admin Login</h3>
            <p className="text-sm text-slate-500">Provision a complete client account with managed admin access.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Client Type</span>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {CLIENT_TYPE_OPTIONS.map((option) => {
                const selected = form.clientType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => update("clientType", option.value)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      selected ? "border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-100" : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                    }`}
                  >
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <label>
            <span className="text-sm font-semibold text-slate-700">{getClientTypeLabel(form.clientType)} Name</span>
            <input value={form.societyName} onChange={(event) => update("societyName", event.target.value)} type="text" className="field-glass mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none" required />
          </label>
          <label>
            <span className="text-sm font-semibold text-slate-700">Admin Full Name</span>
            <input value={form.adminName} onChange={(event) => update("adminName", event.target.value)} type="text" className="field-glass mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none" required />
          </label>
          <label>
            <span className="text-sm font-semibold text-slate-700">Admin Email</span>
            <input value={form.adminEmail} onChange={(event) => update("adminEmail", event.target.value)} type="email" className="field-glass mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none" required />
          </label>
          <label>
            <span className="text-sm font-semibold text-slate-700">Admin Phone</span>
            <input value={form.adminPhone} onChange={(event) => update("adminPhone", event.target.value)} type="text" className="field-glass mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none" />
          </label>
          <label className="md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Temporary Password</span>
            <span className="field-glass mt-2 flex h-11 items-center rounded-xl px-3">
              <input value={form.adminPassword} onChange={(event) => update("adminPassword", event.target.value)} type={showPw ? "text" : "password"} className="w-full bg-transparent text-sm outline-none" required />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="ml-2 shrink-0 text-slate-400 hover:text-slate-700 transition">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </span>
            <p className="mt-1.5 text-xs text-slate-500">Minimum 8 characters. Share securely with client admin.</p>
          </label>
          <label className="md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">{getClientTypeLabel(form.clientType)} Address</span>
            <textarea value={form.address} onChange={(event) => update("address", event.target.value)} rows={3} className="field-glass mt-2 w-full rounded-xl px-3 py-2.5 text-sm outline-none" required />
          </label>
          <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
            <input
              type="checkbox"
              checked={form.demoEnabled}
              onChange={(event) => update("demoEnabled", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-blue-300"
            />
            <span>
              <span className="block text-sm font-bold text-blue-900">Enable 10-day demo</span>
              <span className="mt-0.5 block text-xs font-semibold text-blue-700">Client access starts today, warns with days remaining, and stops automatically after the 10th day.</span>
            </span>
          </label>
        </div>

        {status ? <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-sm text-blue-800">{status}</p> : null}
        {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <button disabled={saving} type="submit" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-60">
          <Plus size={18} />
          {saving ? "Creating..." : form.demoEnabled ? "Create Demo Login" : "Create Admin Login"}
        </button>
      </form>

      <aside className="grid gap-4">
        <section className="panel rounded-2xl p-6">
          <h4 className="text-base font-bold text-slate-950">Provisioning Checklist</h4>
          <div className="mt-4 space-y-2.5">
            {["Choose society or corporate client type", "Create isolated client account and slug", "Provision admin credentials", "Grant admin dashboard access"].map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-700">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-blue-600" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-2xl p-6">
          <h4 className="text-base font-bold text-slate-950">After Onboarding</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>- Society clients use residents, flats, towers, and guards.</li>
            <li>- Corporate clients use offices, workplace units, and guards.</li>
            <li>- Visitor operations start under isolated company tenancy.</li>
          </ul>
        </section>
      </aside>
    </section>
  );
}

export function SocietyClients({ session, societies: providedSocieties, loading: providedLoading = false, error: providedError = "", embedded = false, onSubscriptionUpdated }) {
  const live = useSocieties(session?.accessToken);
  const societies = providedSocieties || live.societies;
  const loading = providedSocieties ? providedLoading : live.loading;
  const error = providedSocieties ? providedError : live.error;

  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return societies;
    return societies.filter((client) =>
      [client.name, client.slug, client.billingEmail, getClientTypeLabel(client.clientType), client.admin?.name, client.admin?.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [societies, query]);

  const handleSaved = async () => {
    if (!providedSocieties) {
      await live.reload();
    }
    await onSubscriptionUpdated?.();
  };

  return (
    <section className="panel rounded-2xl p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Building2 size={20} />
          </span>
          <div>
            <h3 className="text-lg font-bold text-slate-950">Client Accounts</h3>
            <p className="text-sm text-slate-500">Portfolio-wide client list with activity and account health.</p>
          </div>
        </div>

        <label className="field-glass flex h-10 min-w-[220px] items-center gap-2 rounded-xl px-3">
          <Search size={15} className="text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client, admin, email..." className="w-full bg-transparent text-sm text-slate-900 outline-none" />
        </label>
      </div>

      {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="ops-table w-full min-w-[1120px] text-left text-sm">
          <thead>
            <tr>
              <th>Client</th>
              <th>Client Admin</th>
              <th>Footprint</th>
              <th>Tier</th>
              <th>Account</th>
              <th>Subscription</th>
              <th>Expires</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="py-4 text-slate-500" colSpan={8}>Loading societies...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="py-4 text-slate-500" colSpan={8}>No societies found.</td></tr>
            ) : (
              filtered.map((client) => {
                const tier = getSocietyTier(client);
                const subscription = client.subscription || {};
                return (
                  <tr key={client.id} className="text-slate-600">
                    <td className="py-4">
                      <p className="font-semibold text-slate-950">{client.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{client.slug} | {getClientTypeLabel(client.clientType)}</p>
                    </td>
                    <td>
                      <p className="font-medium text-slate-900">{client.admin?.name || "Not assigned"}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{client.admin?.email || client.billingEmail || "No email"}</p>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <span className="rounded-lg bg-slate-100 px-2 py-1">Gates: {formatNumber(client.gates)}</span>
                        <span className="rounded-lg bg-slate-100 px-2 py-1">{client.clientType === "CORPORATE" ? "Offices" : "Flats"}: {formatNumber(client.flats)}</span>
                        <span className="rounded-lg bg-slate-100 px-2 py-1">Visitors: {formatNumber(client.visitors)}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${tier.className}`}>{tier.label}</span>
                    </td>
                    <td><StatusBadge isActive={client.isActive} /></td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <SubscriptionBadge status={subscription.effectiveStatus || subscription.status} />
                        <p className="text-[11px] font-semibold text-slate-500">{subscription.plan || "STARTER"} | {subscription.billingCycle || "MONTHLY"}</p>
                        <p className="text-[11px] font-semibold text-slate-600">{formatMoney(subscription.amount, subscription.currency)}</p>
                        {subscription.warning?.message ? <p className="text-[11px] font-bold text-amber-700">{subscription.warning.message}</p> : null}
                      </div>
                    </td>
                    <td>
                      <p className="text-xs font-semibold text-slate-700">{formatDate(subscription.expiresAt)}</p>
                    </td>
                    <td>
                      <button type="button" onClick={() => setEditingId((prev) => (prev === client.id ? "" : client.id))} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        {editingId === client.id ? "Hide" : "Manage"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editingId ? (
        <SubscriptionEditor
          token={session?.accessToken}
          client={filtered.find((item) => item.id === editingId) || societies.find((item) => item.id === editingId)}
          onClose={() => setEditingId("")}
          onSaved={handleSaved}
        />
      ) : null}

      {!embedded ? <p className="mt-4 text-xs text-slate-500">Tip: Use this as your primary account health snapshot before support calls.</p> : null}
    </section>
  );
}

export function ClientAdmins({ session }) {
  const { societies, loading, error } = useSocieties(session?.accessToken);
  const admins = societies.map((s) => ({ ...s.admin, societyName: s.name, clientType: s.clientType, isActive: s.isActive })).filter((admin) => admin?.email);

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Client Access"
        title="Client Admin Directory"
        description="All client admin identities with ownership mapping and contact readiness."
        stats={[
          { label: "Admins", value: formatNumber(admins.length) },
          { label: "Active Clients", value: formatNumber(societies.filter((s) => s.isActive).length) },
          { label: "Needs Setup", value: formatNumber(societies.filter((s) => !s.admin).length) }
        ]}
      />

      <section className="panel rounded-2xl p-6">
        {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="space-y-3">
          {loading ? (
            <p className="py-2 text-sm text-slate-500">Loading admin directory...</p>
          ) : admins.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">No client admin accounts yet.</p>
          ) : (
            admins.map((admin) => (
              <article key={admin.id || admin.email} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{admin.name || "Unknown admin"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1"><Mail size={13} /> {admin.email}</span>
                      {admin.phone ? <span className="inline-flex items-center gap-1"><Phone size={13} /> {admin.phone}</span> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                      {admin.societyName} | {getClientTypeLabel(admin.clientType)}
                    </span>
                    <StatusBadge isActive={admin.isActive} />
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="panel rounded-2xl p-5">
          <div className="flex items-center gap-2 text-blue-700">
            <ShieldCheck size={18} />
            <p className="font-bold">Access Discipline</p>
          </div>
          <p className="mt-2 text-sm text-slate-600">Ensure each client has exactly one accountable primary admin before go-live.</p>
        </article>
        <article className="panel rounded-2xl p-5">
          <div className="flex items-center gap-2 text-blue-700">
            <Mail size={18} />
            <p className="font-bold">Communication Readiness</p>
          </div>
          <p className="mt-2 text-sm text-slate-600">Validate billing and operational email alignment to avoid support escalations.</p>
        </article>
        <article className="panel rounded-2xl p-5">
          <div className="flex items-center gap-2 text-indigo-700">
            <UsersRound size={18} />
            <p className="font-bold">Ownership Visibility</p>
          </div>
          <p className="mt-2 text-sm text-slate-600">Keep a single source of truth for client account owner mapping and status.</p>
        </article>
      </section>
    </section>
  );
}

export function SubscriptionPortfolio({ session }) {
  const { societies, loading, error, reload } = useSocieties(session?.accessToken);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return societies;
    return societies.filter((client) =>
      [client.name, client.slug, client.admin?.name, client.admin?.email, client.subscription?.plan, client.subscription?.effectiveStatus, client.subscription?.currency, client.subscription?.amount]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [societies, query]);

  const subscriptionStats = useMemo(() => {
    const all = societies.map((item) => item.subscription || {});
    const byStatus = all.reduce((acc, sub) => {
      const key = String(sub.effectiveStatus || sub.status || "ACTIVE").toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const byPlan = all.reduce((acc, sub) => {
      const key = String(sub.plan || "STARTER").toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const expiringSoon = all.filter((sub) => {
      const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
      if (!expiresAt || Number.isNaN(expiresAt.getTime())) return false;
      const days = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 15;
    }).length;
    const monthlyRevenue = all.reduce((sum, sub) => {
      const amount = Number(sub.amount || 0);
      const cycle = String(sub.billingCycle || "MONTHLY").toUpperCase();
      if (cycle === "YEARLY") return sum + amount / 12;
      if (cycle === "QUARTERLY") return sum + amount / 3;
      if (cycle === "ONE_TIME") return sum + 0;
      return sum + amount;
    }, 0);

    return { byStatus, byPlan, expiringSoon, monthlyRevenue };
  }, [societies]);

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Billing & Access"
        title="Subscription Portfolio"
        description="Manage all client subscriptions in one place: status, plan mix, expiry risk, and login access control."
        stats={[
          { label: "Clients", value: formatNumber(societies.length) },
          { label: "Approx MRR (INR)", value: formatNumber(Math.round(subscriptionStats.monthlyRevenue)) },
          { label: "Expiring <=15d", value: formatNumber(subscriptionStats.expiringSoon) },
          { label: "Suspended", value: formatNumber(subscriptionStats.byStatus.SUSPENDED || 0) }
        ]}
      />

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Loading subscription portfolio...</p> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active", value: subscriptionStats.byStatus.ACTIVE || 0, tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
          { label: "Trial", value: subscriptionStats.byStatus.TRIAL || 0, tone: "bg-blue-50 text-blue-700 ring-blue-200" },
          { label: "Suspended", value: subscriptionStats.byStatus.SUSPENDED || 0, tone: "bg-amber-50 text-amber-700 ring-amber-200" },
          { label: "Cancelled/Expired", value: (subscriptionStats.byStatus.CANCELLED || 0) + (subscriptionStats.byStatus.EXPIRED || 0), tone: "bg-rose-50 text-rose-700 ring-rose-200" }
        ].map((item) => (
          <article key={item.label} className="panel rounded-2xl p-5">
            <p className="text-sm font-semibold text-slate-600">{item.label}</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-3xl font-bold text-slate-950 tabular-nums">{formatNumber(item.value)}</p>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${item.tone}`}>{item.label}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="panel rounded-2xl p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">All Subscriptions</h3>
            <p className="text-sm text-slate-500">Multiple client subscriptions with quick edit control.</p>
          </div>
          <label className="field-glass flex h-10 min-w-[240px] items-center gap-2 rounded-xl px-3">
            <Search size={15} className="text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client, plan, status..." className="w-full bg-transparent text-sm text-slate-900 outline-none" />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="ops-table w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr>
                <th>Client</th>
                <th>Plan</th>
                <th>Price</th>
                <th>Cycle</th>
                <th>Status</th>
                <th>Starts</th>
                <th>Expires</th>
                <th>Admin</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td className="py-4 text-slate-500" colSpan={9}>No subscription records found.</td></tr>
              ) : (
                filtered.map((client) => {
                  const subscription = client.subscription || {};
                  return (
                    <tr key={client.id}>
                      <td className="py-4">
                        <p className="font-semibold text-slate-950">{client.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{client.slug} | {getClientTypeLabel(client.clientType)}</p>
                      </td>
                      <td><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{subscription.plan || "STARTER"}</span></td>
                      <td className="text-xs font-semibold text-slate-700">{formatMoney(subscription.amount, subscription.currency)}</td>
                      <td className="text-xs font-semibold text-slate-600">{subscription.billingCycle || "MONTHLY"}</td>
                      <td><SubscriptionBadge status={subscription.effectiveStatus || subscription.status} /></td>
                      <td className="text-xs text-slate-600">{formatDate(subscription.startsAt)}</td>
                      <td>
                        <p className="text-xs font-semibold text-slate-700">{formatDate(subscription.expiresAt)}</p>
                        {subscription.warning?.message ? <p className="mt-0.5 text-[11px] font-bold text-amber-700">{subscription.warning.message}</p> : null}
                      </td>
                      <td>
                        <p className="text-sm text-slate-800">{client.admin?.name || "Not assigned"}</p>
                        <p className="text-xs text-slate-500">{client.admin?.email || "-"}</p>
                      </td>
                      <td>
                        <button type="button" onClick={() => setEditingId((prev) => (prev === client.id ? "" : client.id))} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          {editingId === client.id ? "Hide" : "Manage"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {editingId ? (
          <SubscriptionEditor
            token={session?.accessToken}
            client={filtered.find((item) => item.id === editingId) || societies.find((item) => item.id === editingId)}
            onClose={() => setEditingId("")}
            onSaved={reload}
          />
        ) : null}
      </section>
    </section>
  );
}

export function SuperAdminFeaturePage({ feature, session }) {
  if (feature === "SaaS Dashboard") return <SuperDashboard session={session} />;
  if (feature === "Onboard Client" || feature === "Onboard Society") return <OnboardSociety session={session} />;
  if (feature === "Subscriptions") return <SubscriptionPortfolio session={session} />;
  if (feature === "Client Accounts" || feature === "Society Clients") return <SocietyClients session={session} />;
  if (feature === "Client Admins") return <ClientAdmins session={session} />;
  return <SuperDashboard session={session} />;
}

