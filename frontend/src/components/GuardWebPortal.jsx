import {
  AlertTriangle,
  Bell,
  CheckCircle,
  FileText,
  Lock,
  LogOut,
  Plus,
  Send,
  Shield,
  Truck,
  User,
  Users,
  X,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { societyApi } from "../lib/api";
import mehmanMark from "../assets/mehman-mark.webp";
import { SubscriptionNotice } from "./SubscriptionNotice";
import { ChangePasswordModal } from "./ChangePasswordModal";

const showToast = (message, type = "success") => {
  if (typeof window !== "undefined" && message) {
    window.dispatchEvent(new CustomEvent("mehman:toast", { detail: { message, type } }));
  }
};

const TABS = [
  { id: "entry",    label: "Visitor Entry",    Icon: User        },
  { id: "queue",    label: "Approval Queue",   Icon: Users       },
  { id: "vehicle",  label: "Vehicle Entry",    Icon: Truck       },
  { id: "delivery", label: "Delivery & Staff", Icon: FileText    },
  { id: "reports",  label: "Reports / SOS",    Icon: AlertTriangle },
  { id: "alerts",   label: "Notifications",    Icon: Bell        }
];

export function GuardWebPortal({ session, onLogout }) {
  const user  = session.user;
  const token = session.accessToken;
  const [tab, setTab] = useState("entry");
  const [showChangePw, setShowChangePw] = useState(false);
  const [branches, setBranches] = useState([]);
  const [flats, setFlats]       = useState([]);

  useEffect(() => {
    Promise.all([
      societyApi.branches(token),
      societyApi.flats(token)
    ]).then(([bData, fData]) => {
      setBranches(bData.branches || []);
      setFlats(fData.flats || []);
    }).catch(() => {});
  }, []);

  const initials = (user.name || "G")
    .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const sharedProps = { token, branches, flats };

  return (
    <div className="app-shell min-h-screen bg-transparent flex flex-col">
      {showChangePw && (
        <ChangePasswordModal
          token={token}
          forced={false}
          onSuccess={() => setShowChangePw(false)}
          onClose={() => setShowChangePw(false)}
        />
      )}
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white/85 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white ring-1 ring-blue-500/10">
            <img src={mehmanMark} alt="Mehman logo" className="h-full w-full object-contain p-1" />
          </div>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white font-bold text-sm ring-1 ring-blue-500/20">
            {initials}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Mehman Guard Portal</p>
            <p className="text-sm font-bold text-slate-900 leading-tight">{user.name}</p>
          </div>
          {user.branch?.name && (
            <span className="hidden sm:inline-block rounded-xl border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              <Shield size={11} className="inline mr-1" />
              {user.branch.name}
            </span>
          )}
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <SubscriptionNotice session={session} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChangePw(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
            title="Change Password"
          >
            <Lock size={15} />
            <span className="hidden sm:inline">Password</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition ${
                tab === id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="app-content flex-1 px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {tab === "entry"    && <VisitorEntryForm {...sharedProps} />}
          {tab === "queue"    && <ApprovalQueue    token={token}   />}
          {tab === "vehicle"  && <VehicleEntry     {...sharedProps} />}
          {tab === "delivery" && <DeliveryStaff    {...sharedProps} />}
          {tab === "reports"  && <GuardReports     token={token} branchId={user.branchId} />}
          {tab === "alerts"   && <GuardAlerts      token={token} />}
        </div>
      </main>
    </div>
  );
}

function GuardAlerts({ token }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await societyApi.notifications(token, "?limit=60");
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err.message || "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const markRead = async (id) => {
    try {
      await societyApi.markNotificationRead(token, id);
      setStatus("Notification marked read.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to mark notification read");
    }
  };

  const markAllRead = async () => {
    try {
      await societyApi.markAllRead(token);
      setStatus("All notifications marked read.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to mark notifications read");
    }
  };

  const unread = notifications.filter((item) => !item.readAt);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader eyebrow="Notifications" title="Guard Alerts" desc={`${unread.length} unread alert${unread.length === 1 ? "" : "s"}.`} />
        {unread.length > 0 ? (
          <button type="button" onClick={markAllRead} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">
            Mark all read
          </button>
        ) : null}
      </div>
      {error && <ErrorBox msg={error} />}
      {status && <SuccessBox msg={status} />}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <p className="text-sm font-bold text-slate-900">All Notifications</p>
        </div>
        {loading ? <p className="px-5 py-8 text-sm text-slate-400">Loading...</p> :
          notifications.length === 0 ? <p className="px-5 py-8 text-sm text-slate-400">No notifications yet.</p> :
          notifications.map((item) => (
            <div key={item.id} className={`flex items-start gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 ${!item.readAt ? "bg-blue-50/50" : ""}`}>
              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${!item.readAt ? "bg-blue-500" : "bg-slate-200"}`} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{item.title}</p>
                {item.body ? <p className="mt-0.5 text-sm text-slate-500">{item.body}</p> : null}
                <p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
              {!item.readAt ? (
                <button type="button" onClick={() => markRead(item.id)} className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                  Mark read
                </button>
              ) : null}
            </div>
          ))
        }
      </div>
    </div>
  );
}

/* -- Visitor Entry -- */
function VisitorEntryForm({ token, branches, flats }) {
  const [form, setForm] = useState({ fullName: "", phone: "", purpose: "", flatId: "", tower: "", floor: "", branchId: "" });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError]   = useState("");

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const towers  = [...new Set(flats.map((f) => f.tower).filter(Boolean))];
  const floors  = [...new Set(flats.filter((f) => !form.tower || f.tower === form.tower).map((f) => f.floor).filter(Boolean))];
  const visible = flats.filter((f) => (!form.tower || f.tower === form.tower) && (!form.floor || f.floor === form.floor));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await societyApi.createVisitor(token, {
        fullName:  form.fullName.trim(),
        phone:     form.phone.trim(),
        purpose:   form.purpose.trim() || "Visitor",
        flatId:    form.flatId || undefined,
        branchId:  form.branchId || undefined,
        passType:  "VISITOR"
      });
      setStatus("Visitor entry created and sent to resident for approval.");
      setForm({ fullName: "", phone: "", purpose: "", flatId: "", tower: "", floor: "", branchId: "" });
    } catch (err) {
      setError(err.message || "Unable to create visitor entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <div>
        <PageHeader eyebrow="Visitor Entry" title="Register Visitor" desc="Fill in visitor details. The resident will be notified to approve." />
        <form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Visitor Full Name" value={form.fullName} onChange={(v) => update("fullName", v)} required />
            <FormField label="Mobile Number"     value={form.phone}    onChange={(v) => update("phone", v)}    required />
            <FormField label="Purpose"           value={form.purpose}  onChange={(v) => update("purpose", v)}  />
          </div>

          {/* Flat selector */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 grid gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Select Flat</p>
            {towers.length > 0 && (
              <ChipGroup label="Tower" items={towers} selected={form.tower} onSelect={(v) => { update("tower", v); update("floor", ""); update("flatId", ""); }} />
            )}
            {form.tower && floors.length > 0 && (
              <ChipGroup label="Floor" items={floors.map((f) => `Floor ${f}`)} selected={form.floor ? `Floor ${form.floor}` : ""} onSelect={(v) => { update("floor", v.replace("Floor ", "")); update("flatId", ""); }} />
            )}
            {(form.floor || towers.length === 0) && (
              <ChipGroup label="Flat" items={visible.map((f) => f.flatNumber)} selected={visible.find((f) => f.id === form.flatId)?.flatNumber || ""} onSelect={(v) => { const flat = visible.find((f) => f.flatNumber === v); update("flatId", flat?.id || ""); }} />
            )}
          </div>

          {/* Gate selector */}
          {branches.length > 1 && (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Gate</span>
              <select value={form.branchId} onChange={(e) => update("branchId", e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500">
                <option value="">Select gate</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}

          {status && <SuccessBox msg={status} />}
          {error  && <ErrorBox  msg={error}  />}
          <button disabled={saving || !form.fullName || !form.phone} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50 hover:bg-blue-700 transition">
            <Send size={16} /> {saving ? "Sending..." : "Send for Approval"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="font-bold text-slate-900 mb-3">Quick Tips</p>
        <ul className="space-y-2 text-sm text-slate-600">
          {[
            "Select flat to auto-identify resident",
            "Resident gets instant notification",
            "Guard cannot approve - only residents can",
            "Approved pass shows in approval queue"
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <Plus size={14} className="mt-0.5 shrink-0 text-blue-500" /> {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -- Approval Queue -- */
function ApprovalQueue({ token }) {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState("");
  const [error, setError]       = useState("");

  const load = async () => {
    try {
      const d = await societyApi.visitors(token, "?status=ACTIVE");
      setVisitors(d.visitors || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const approve = async (passId, action) => {
    setStatus("");
    setError("");
    try {
      await societyApi.updateGatepassStatus(token, passId, { status: action });
      setStatus(action === "CHECKED_IN" ? "Visitor checked in." : "Visitor checked out.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to update status");
    }
  };

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Queue" title="Resident Approval Queue" desc="Visitor passes approved by residents - ready for check-in/out." />
      {error  && <ErrorBox  msg={error}  />}
      {status && <SuccessBox msg={status} />}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5 flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900">Active Passes</p>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">{visitors.length}</span>
        </div>
        {loading ? <p className="px-5 py-8 text-sm text-slate-400">Loading...</p> :
          visitors.length === 0 ? <p className="px-5 py-8 text-sm text-slate-400">No active passes at your gate.</p> :
          visitors.map((v) => {
            const pass = v.gatepasses?.[0];
            return (
              <div key={v.id} className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{v.fullName}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{v.phone}  | {v.purpose}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">Pass: {pass?.passCode}</p>
                </div>
                <StatusBadge status={pass?.status} />
                <div className="flex gap-2">
                  {pass?.status === "ACTIVE" && (
                    <button onClick={() => approve(pass.id, "CHECKED_IN")} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
                      <CheckCircle size={13} /> Check In
                    </button>
                  )}
                  {pass?.status === "CHECKED_IN" && (
                    <button onClick={() => approve(pass.id, "CHECKED_OUT")} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white">
                      <XCircle size={13} /> Check Out
                    </button>
                  )}
                </div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

/* -- Vehicle Entry -- */
function VehicleEntry({ token, branches, flats }) {
  const [form, setForm] = useState({ vehicleNumber: "", ownerName: "", phone: "", flatId: "", branchId: "" });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError]   = useState("");
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await societyApi.createVisitor(token, {
        fullName:  form.ownerName.trim(),
        phone:     form.phone.trim(),
        purpose:   "Vehicle Entry",
        flatId:    form.flatId || undefined,
        branchId:  form.branchId || undefined,
        passType:  "VEHICLE",
        vehicle:   { number: form.vehicleNumber.trim(), type: "GUEST" }
      });
      setStatus("Vehicle entry logged and sent for approval.");
      setForm({ vehicleNumber: "", ownerName: "", phone: "", flatId: "", branchId: "" });
    } catch (err) {
      setError(err.message || "Unable to log vehicle");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Vehicle" title="Vehicle Entry / Exit" desc="Log guest vehicle number plate and link to resident flat." />
      <form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Vehicle Number Plate" value={form.vehicleNumber} onChange={(v) => update("vehicleNumber", v)} required />
          <FormField label="Driver / Owner Name"  value={form.ownerName}     onChange={(v) => update("ownerName", v)}     required />
          <FormField label="Mobile Number"        value={form.phone}         onChange={(v) => update("phone", v)}         />
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Flat (optional)</span>
          <select value={form.flatId} onChange={(e) => update("flatId", e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="">Select flat</option>
            {flats.map((f) => <option key={f.id} value={f.id}>{f.flatNumber}{f.tower ? ` (${f.tower})` : ""}</option>)}
          </select>
        </label>
        {branches.length > 1 && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Gate</span>
            <select value={form.branchId} onChange={(e) => update("branchId", e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500">
              <option value="">Select gate</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}
        {status && <SuccessBox msg={status} />}
        {error  && <ErrorBox  msg={error}  />}
        <button disabled={saving || !form.vehicleNumber || !form.ownerName} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50">
          <Truck size={16} /> {saving ? "Logging..." : "Log Vehicle Entry"}
        </button>
      </form>
    </div>
  );
}

/* -- Delivery & Staff -- */
function DeliveryStaff({ token, flats }) {
  const [form, setForm] = useState({ name: "", idProof: "", flatId: "", note: "", type: "Delivery" });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError]   = useState("");
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await societyApi.createOperation(token, {
        title:       `${form.type}: ${form.name.trim()}`,
        description: form.note.trim() || `${form.type} entry at gate`,
        category:    "Delivery",
        payload:     { name: form.name, idProof: form.idProof, flatId: form.flatId, type: form.type }
      });
      setStatus(`${form.type} entry logged successfully.`);
      setForm({ name: "", idProof: "", flatId: "", note: "", type: "Delivery" });
    } catch (err) {
      setError(err.message || "Unable to log entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Delivery & Staff" title="Delivery / Maid / Vendor Entry" desc="Record ID proof and flat for delivery personnel, maids, and vendors." />
      <form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4">
        <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
          {["Delivery", "Maid", "Staff", "Vendor"].map((t) => (
            <button key={t} type="button" onClick={() => update("type", t)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${form.type === t ? "bg-blue-600 text-white" : "text-slate-500"}`}>{t}</button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name / Person"        value={form.name}    onChange={(v) => update("name", v)}    required />
          <FormField label="ID Proof / Company"   value={form.idProof} onChange={(v) => update("idProof", v)} />
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Flat</span>
          <select value={form.flatId} onChange={(e) => update("flatId", e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500">
            <option value="">Select flat</option>
            {flats.map((f) => <option key={f.id} value={f.id}>{f.flatNumber}{f.tower ? ` (${f.tower})` : ""}</option>)}
          </select>
        </label>
        <FormField label="Remarks" value={form.note} onChange={(v) => update("note", v)} />
        {status && <SuccessBox msg={status} />}
        {error  && <ErrorBox  msg={error}  />}
        <button disabled={saving || !form.name} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50">
          <Plus size={16} /> {saving ? "Logging..." : "Log Entry"}
        </button>
      </form>
    </div>
  );
}

/* -- Reports / SOS -- */
function GuardReports({ token, branchId }) {
  const [reportType, setReportType] = useState("sos");
  const [note, setNote]             = useState("");
  const [saving, setSaving]         = useState(false);
  const [status, setStatus]         = useState("");
  const [error, setError]           = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await societyApi.createOperation(token, {
        title:       reportType === "sos" ? "Emergency SOS" : "Facility Report",
        description: note.trim(),
        category:    reportType === "sos" ? "Emergency" : "Facility",
        priority:    reportType === "sos" ? "CRITICAL" : "NORMAL",
        branchId:    branchId || undefined
      });
      setStatus(reportType === "sos" ? "Emergency SOS sent to admin and security team." : "Facility report submitted.");
      setNote("");
    } catch (err) {
      setError(err.message || "Unable to submit report");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_.8fr]">
      <div>
        <PageHeader eyebrow="Reports" title="Emergency SOS & Facility Reports" desc="Raise a critical SOS or log a gate/facility issue." />
        <div className="mt-6 flex gap-2">
          <button onClick={() => setReportType("sos")} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${reportType === "sos" ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
            <AlertTriangle size={15} /> Emergency SOS
          </button>
          <button onClick={() => setReportType("facility")} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${reportType === "facility" ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
            <FileText size={15} /> Facility Report
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              {reportType === "sos" ? "Describe the emergency situation" : "Describe the facility issue and location"}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              required
              placeholder={reportType === "sos" ? "What is the emergency? Who is involved? Where exactly?" : "What issue? Which gate or area? Broken equipment, lighting, cleanliness..."}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </label>
          {status && <SuccessBox msg={status} />}
          {error  && <ErrorBox  msg={error}  />}
          <button
            disabled={saving || !note.trim()}
            className={`inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50 transition ${reportType === "sos" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {reportType === "sos" ? <><AlertTriangle size={16} /> {saving ? "Sending..." : "Send SOS Alert"}</> : <><Send size={16} /> {saving ? "Submitting..." : "Submit Report"}</>}
          </button>
        </form>
      </div>

      <div className={`rounded-2xl border p-6 ${reportType === "sos" ? "border-red-200 bg-red-50" : "border-blue-100 bg-blue-50"}`}>
        <AlertTriangle size={22} className={reportType === "sos" ? "text-red-600" : "text-blue-600"} />
        <p className={`mt-3 font-bold ${reportType === "sos" ? "text-red-900" : "text-blue-900"}`}>
          {reportType === "sos" ? "Use only for real emergencies" : "Facility Report"}
        </p>
        <p className={`mt-2 text-sm ${reportType === "sos" ? "text-red-700" : "text-blue-800"}`}>
          {reportType === "sos"
            ? "This immediately alerts society admin and the security team. Use for medical, fire, intrusion, or other critical incidents."
            : "Log broken gates, lighting, cleanliness, or infrastructure issues. Admin will review and assign maintenance."}
        </p>
      </div>
    </div>
  );
}

/* -- Shared primitives -- */
function PageHeader({ eyebrow, title, desc }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
      {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500"
      />
    </label>
  );
}

function ChipGroup({ label, items, selected, onSelect }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button key={item} type="button" onClick={() => onSelect(item)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${selected === item ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"}`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    DRAFT:      "bg-amber-50 text-amber-700 border-amber-200",
    PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
    ACTIVE:     "bg-blue-50 text-blue-700 border-blue-200",
    CHECKED_IN: "bg-blue-50 text-blue-700 border-blue-200",
    CHECKED_OUT:"bg-slate-100 text-slate-600 border-slate-200",
    CANCELLED:  "bg-red-50 text-red-700 border-red-200",
    OPEN:       "bg-amber-50 text-amber-700 border-amber-200"
  };
  return (
    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${map[status] || "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {status}
    </span>
  );
}

function SuccessBox({ msg }) {
  useEffect(() => { showToast(msg, "success"); }, [msg]);
  return <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"><CheckCircle size={15} className="mt-0.5 shrink-0" />{msg}</div>;
}

function ErrorBox({ msg }) {
  useEffect(() => { showToast(msg, "error"); }, [msg]);
  return <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><X size={15} className="mt-0.5 shrink-0" />{msg}</div>;
}

