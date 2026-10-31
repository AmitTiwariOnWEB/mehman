import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  MessageSquare,
  Plus,
  RefreshCw,
  Wrench,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { societyApi } from "../lib/api";
import { StatusPill, WorkflowHeader } from "./WorkflowPrimitives";

const showToast = (message, type = "success") => {
  if (typeof window !== "undefined" && message) {
    window.dispatchEvent(new CustomEvent("mehman:toast", { detail: { message, type } }));
  }
};

function FormAlert({ type, msg }) {
  const isError = type === "error";
  useEffect(() => {
    if (msg) showToast(msg, isError ? "error" : "success");
  }, [msg, isError]);
  if (!msg) return null;
  return (
    <p className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
      isError ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-800"
    }`}>
      {msg}
    </p>
  );
}

function SectionCard({ children, className = "" }) {
  return <div className={`panel rounded-xl ${className}`}>{children}</div>;
}

function FieldLabel({ children }) {
  return <span className="text-sm font-semibold text-slate-700">{children}</span>;
}

function Input({ value, onChange, placeholder = "", type = "text", required = false }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      required={required}
      className="field-glass mt-1.5 h-11 w-full rounded-xl px-3 text-sm text-slate-900 outline-none"
    />
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="field-glass mt-1.5 h-11 w-full rounded-xl px-3 text-sm text-slate-900 outline-none"
    >
      {children}
    </select>
  );
}

function Textarea({ value, onChange, placeholder = "", rows = 4, required = false }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      required={required}
      className="field-glass mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none resize-none"
    />
  );
}

function ActionBtn({ children, onClick, disabled = false, variant = "primary" }) {
  const tone =
    variant === "danger"
      ? "border border-red-200 bg-red-50 text-red-700"
      : variant === "secondary"
        ? "border border-slate-200 bg-white text-slate-700"
        : "bg-blue-600 text-white";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-60 ${tone}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ title, desc }) {
  return (
    <div className="py-10 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{desc}</p>
    </div>
  );
}

const toIsoDateTimeOrEmpty = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid voting limit date and time.");
  return parsed.toISOString();
};

function useFlatTargeting(session, form) {
  const [flats, setFlats] = useState([]);

  useEffect(() => {
    societyApi.flats(session.accessToken).then((data) => setFlats(data.flats || [])).catch(() => setFlats([]));
  }, [session.accessToken]);

  const branchOptions = useMemo(
    () => Array.from(new Map(flats.filter((f) => f.branch).map((f) => [f.branch.id, f.branch])).values()),
    [flats]
  );

  const filteredFlats = flats.filter((flat) => (form.branchId ? flat.branchId === form.branchId : true));
  const towerOptions = Array.from(new Set(filteredFlats.map((flat) => flat.tower).filter(Boolean))).sort();
  const floorOptions = Array.from(
    new Set(filteredFlats.filter((flat) => (form.tower ? flat.tower === form.tower : true)).map((flat) => flat.floor).filter(Boolean))
  ).sort();
  const flatOptions = filteredFlats.filter(
    (flat) => (form.tower ? flat.tower === form.tower : true) && (form.floor ? flat.floor === form.floor : true)
  );

  return { flats, branchOptions, towerOptions, floorOptions, flatOptions };
}

function buildTarget(form, flats) {
  const selectedFlat = flats.find((flat) => flat.id === form.flatId);
  return {
    selectedFlat,
    target: {
      branchId: form.branchId || selectedFlat?.branchId || null,
      tower: form.tower || selectedFlat?.tower || "",
      floor: form.floor || selectedFlat?.floor || "",
      flatId: form.targetScope === "FLAT" ? selectedFlat?.id || null : null,
      flatNumber: form.targetScope === "FLAT" ? selectedFlat?.flatNumber || "" : ""
    }
  };
}

const operationRecords = (data) => data.records || data.operations || [];

const replaceRecord = (records, updatedRecord) =>
  records.map((record) => (record.id === updatedRecord.id ? updatedRecord : record));

export function NotificationsInbox({ session }) {
  const [visitors, setVisitors] = useState([]);
  const [operations, setOperations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [denyNotes, setDenyNotes] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [vData, opData, nData] = await Promise.all([
        societyApi.visitors(session.accessToken),
        societyApi.operations(session.accessToken, "?limit=40"),
        societyApi.notifications(session.accessToken, "?limit=20").catch(() => ({ notifications: [] }))
      ]);
      setVisitors(vData.visitors || []);
      setOperations(opData.records || opData.operations || []);
      setNotifications(nData.notifications || []);
    } catch (err) {
      setError(err.message || "Unable to load inbox");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [session.accessToken]);

  const openOps = operations.filter((o) => ["OPEN", "WORKING", "IN_PROGRESS", "PENDING_APPROVAL"].includes(o.status));
  const unread = notifications.filter((n) => !n.readAt);

  const setOperationStatus = async (op, nextStatus) => {
    try {
      await societyApi.updateOperation(session.accessToken, op.id, { status: nextStatus });
      setStatus(`${op.title} -> ${nextStatus}`);
      await load();
    } catch (err) {
      setError(err.message || "Unable to update request");
    }
  };

  const reviewPayment = async (op, approved) => {
    const note = String(denyNotes[op.id] || "").trim();
    if (!approved && !note) {
      setError("Enter a rejection note before rejecting the payment.");
      return;
    }
    try {
      await societyApi.updateOperation(session.accessToken, op.id, {
        status: approved ? "RESOLVED" : "OPEN",
        payload: {
          ...(op.payload || {}),
          billState: approved ? "PAID" : "UNPAID",
          ...(approved
            ? {
                paidAt: new Date().toISOString(),
                adminVerifiedAt: new Date().toISOString(),
                adminVerifiedBy: session.user.id,
                paymentDeniedNote: ""
              }
            : {
                paymentDeniedNote: note,
                paymentDeniedAt: new Date().toISOString(),
                paymentDeniedBy: session.user.id
              })
        }
      });
      setStatus(approved ? "Payment marked paid by admin." : "Payment rejected and returned to resident.");
      setDenyNotes((current) => ({ ...current, [op.id]: "" }));
      await load();
    } catch (err) {
      setError(err.message || "Unable to review payment");
    }
  };

  const markAllRead = async () => {
    try {
      await societyApi.markAllRead(session.accessToken);
      setStatus("All notifications marked read.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to mark notifications read");
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Inbox"
        title="Inbox & Approvals"
        description="Visitor approvals, pending requests, and notifications."
        stats={[
          { label: "Visitors", value: visitors.filter((v) => v.gatepasses?.[0]?.status === "DRAFT").length },
          { label: "Requests", value: openOps.length },
          { label: "Unread", value: unread.length }
        ]}
      />

      <FormAlert type="error" msg={error} />
      <FormAlert type="success" msg={status} />

      <SectionCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Action Required</h3>
          <div className="flex items-center gap-3">
            {unread.length > 0 ? (
              <button onClick={markAllRead} className="text-sm font-semibold text-blue-700">
                Mark all read
              </button>
            ) : null}
            <button onClick={load} className="inline-flex items-center gap-2 text-sm text-slate-500">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}

        {!loading && openOps.length === 0 ? (
          <EmptyState title="No pending requests" desc="Everything is up to date." />
        ) : (
          <div className="divide-y divide-slate-100">
            {openOps.map((op) => {
              const amenityPending = /amenity/i.test(op.category || "") && op.status === "PENDING_APPROVAL";
              const paymentPending = /maintenance billing/i.test(op.category || "") && (op.status === "PENDING_APPROVAL" || op.payload?.billState === "PAYMENT_REPORTED");
              return (
                <div key={op.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{op.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{op.category}</p>
                      {op.description ? <p className="text-sm text-slate-600 mt-1">{op.description}</p> : null}
                    </div>
                    <StatusPill status={op.status} priority={op.priority} />
                  </div>
                  {amenityPending ? (
                    <div className="mt-3 flex gap-2">
                      <ActionBtn onClick={() => setOperationStatus(op, "APPROVED")}>Approve Booking</ActionBtn>
                      <ActionBtn variant="danger" onClick={() => setOperationStatus(op, "REJECTED")}>Reject</ActionBtn>
                    </div>
                  ) : null}
                  {paymentPending ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                      <div className="grid gap-1 text-xs text-amber-900 sm:grid-cols-2">
                        <p>Submitted by: {op.payload?.reportedPaidByName || op.createdBy?.name || "Resident"}</p>
                        <p>Paid date: {op.payload?.reportedPaidDate || (op.payload?.reportedPaidAt ? new Date(op.payload.reportedPaidAt).toLocaleDateString() : "-")}</p>
                        <p>Amount: INR {Number(op.payload?.amount || 0).toLocaleString()}</p>
                        <p>Unit: {op.payload?.target?.flatNumber || op.payload?.flatNumber || "-"}</p>
                      </div>
                      <Textarea
                        value={denyNotes[op.id] || ""}
                        onChange={(value) => setDenyNotes((current) => ({ ...current, [op.id]: value }))}
                        placeholder="Rejection note if payment was not received"
                        rows={2}
                      />
                      <div className="flex flex-wrap gap-2">
                        <ActionBtn onClick={() => reviewPayment(op, true)}>Mark Paid</ActionBtn>
                        <ActionBtn variant="danger" onClick={() => reviewPayment(op, false)}>Reject Payment</ActionBtn>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </section>
  );
}

function TargetingFields({ session, form, setForm, branchOptions, towerOptions, floorOptions, flatOptions, showScope = true }) {
  const isCorporate = session?.user?.company?.clientType === "CORPORATE";
  const unitLabel = isCorporate ? "Office Number" : "Flat Number";
  const unitPlaceholder = isCorporate ? "Select office" : "Select flat";
  const unitWiseLabel = isCorporate ? "Office-wise" : "Flat-wise";
  const towerLabel = isCorporate ? "Building" : "Wing / Tower";
  const towerWiseLabel = isCorporate ? "Building-wise" : "Tower / Wing-wise";
  const getUnitNumber = (unit) => unit?.officeNumber || unit?.flatNumber || unit?.unitNumber || unit?.number || unit?.name || "-";

  return (
    <>
      <div className={`grid gap-4 ${showScope ? "sm:grid-cols-2" : ""}`}>
        {showScope ? (
          <label className="block">
            <FieldLabel>Target Scope</FieldLabel>
            <Select value={form.targetScope} onChange={(v) => setForm((f) => ({ ...f, targetScope: v, floor: "", flatId: "" }))}>
              <option value="FLAT">{unitWiseLabel}</option>
              <option value="FLOOR">Floor-wise</option>
              <option value="TOWER">{towerWiseLabel}</option>
            </Select>
          </label>
        ) : null}
        <label className="block">
          <FieldLabel>Gate / Branch</FieldLabel>
          <Select value={form.branchId} onChange={(v) => setForm((f) => ({ ...f, branchId: v, tower: "", floor: "", flatId: "" }))}>
            <option value="">All gates</option>
            {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <FieldLabel>{towerLabel}</FieldLabel>
          <Select value={form.tower} onChange={(v) => setForm((f) => ({ ...f, tower: v, floor: "", flatId: "" }))}>
            <option value="">{isCorporate ? "Select building" : "Select tower"}</option>
            {towerOptions.map((tower) => <option key={tower} value={tower}>{tower}</option>)}
          </Select>
        </label>
        <label className="block">
          <FieldLabel>Floor</FieldLabel>
          <Select value={form.floor} onChange={(v) => setForm((f) => ({ ...f, floor: v, flatId: "" }))}>
            <option value="">Select floor</option>
            {floorOptions.map((floor) => <option key={floor} value={floor}>{floor}</option>)}
          </Select>
        </label>
        <label className="block">
          <FieldLabel>{unitLabel}</FieldLabel>
          <Select value={form.flatId} onChange={(v) => {
            const picked = flatOptions.find((flat) => flat.id === v);
            setForm((f) => ({ ...f, flatId: v, tower: picked?.tower || f.tower, floor: picked?.floor || f.floor }));
          }}>
            <option value="">{unitPlaceholder}</option>
            {flatOptions.map((flat) => <option key={flat.id} value={flat.id}>{getUnitNumber(flat)}</option>)}
          </Select>
        </label>
      </div>
    </>
  );
}

const COMPLAINT_TYPES = ["Noise Complaint", "Parking Issue", "Water Supply", "Electricity", "Cleanliness", "Security Concern", "Other"];
const PRIORITY_OPTS = ["NORMAL", "HIGH", "CRITICAL"];
const statusText = (status = "") =>
  String(status || "").replaceAll("_", " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
const formatWhen = (value) => (value ? new Date(value).toLocaleString() : "-");

export function ComplaintsPage({ session }) {
  const isCorporate = session?.user?.company?.clientType === "CORPORATE";
  const serviceEyebrow = isCorporate ? "Corporate Services" : "Society Services";
  const unitNoun = isCorporate ? "office" : "flat";
  const unitArticle = isCorporate ? "an" : "a";
  const unitTitle = isCorporate ? "Office" : "Flat";
  const towerNoun = isCorporate ? "building" : "tower / wing";
  const towerTitle = isCorporate ? "Building" : "Tower";
  const complaintsDescription = isCorporate
    ? "Target complaints by office, floor, or building."
    : "Target complaints by flat, floor, or tower.";
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    targetScope: "FLAT", branchId: "", tower: "", floor: "", flatId: "", type: "Noise Complaint", description: "", priority: "NORMAL"
  });

  const { flats, branchOptions, towerOptions, floorOptions, flatOptions } = useFlatTargeting(session, form);

  useEffect(() => {
    societyApi.operations(session.accessToken, "?limit=60")
      .then((data) => setRecords((data.records || data.operations || []).filter((r) => r.category === "Complaint")))
      .catch((err) => setError(err.message || "Unable to load complaints"));
  }, [session.accessToken]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const { selectedFlat, target } = buildTarget(form, flats);
      if (form.targetScope === "FLAT" && !selectedFlat) throw new Error(`Please select ${unitArticle} ${unitNoun}`);
      if (["FLOOR", "TOWER"].includes(form.targetScope) && !form.tower) throw new Error(`Please select a ${towerNoun}`);
      if (form.targetScope === "FLOOR" && !form.floor) throw new Error("Please select a floor");

      const label = form.targetScope === "FLAT" ? `${unitTitle} ${target.flatNumber || "Selected"}` : form.targetScope === "FLOOR" ? `${target.tower} Floor ${target.floor}` : `${target.tower} ${towerTitle}`;
      await societyApi.createOperation(session.accessToken, {
        category: "Complaint",
        title: `${form.type} - ${label}`,
        description: form.description,
        priority: form.priority,
        payload: { type: form.type, targetScope: form.targetScope, target }
      });
      setStatus("Complaint submitted successfully.");
      setForm({ targetScope: "FLAT", branchId: "", tower: "", floor: "", flatId: "", type: "Noise Complaint", description: "", priority: "NORMAL" });
    } catch (err) {
      setError(err.message || "Unable to submit complaint");
    } finally {
      setSaving(false);
    }
  };

  const reloadComplaints = async () => {
    const data = await societyApi.operations(session.accessToken, "?limit=60");
    setRecords((data.records || data.operations || []).filter((r) => r.category === "Complaint"));
  };

  const closeComplaint = async (record) => {
    try {
      await societyApi.updateOperation(session.accessToken, record.id, {
        status: "CLOSED",
        payload: { ...(record.payload || {}), closedAt: new Date().toISOString(), closedBy: session.user.id }
      });
      setStatus("Complaint closed.");
      await reloadComplaints();
    } catch (err) {
      setError(err.message || "Unable to close complaint");
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader eyebrow={serviceEyebrow} title="Complaints & Feedback" description={complaintsDescription} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <SectionCard className="p-6">
          <h3 className="font-bold text-slate-900">New Complaint</h3>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <TargetingFields session={session} form={form} setForm={setForm} branchOptions={branchOptions} towerOptions={towerOptions} floorOptions={floorOptions} flatOptions={flatOptions} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><FieldLabel>Complaint Type</FieldLabel><Select value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))}>{COMPLAINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></label>
              <label className="block"><FieldLabel>Priority</FieldLabel><Select value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))}>{PRIORITY_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}</Select></label>
            </div>
            <label className="block"><FieldLabel>Description</FieldLabel><Textarea value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} required /></label>
            <FormAlert type="error" msg={error} />
            <FormAlert type="success" msg={status} />
            <ActionBtn disabled={saving}><Plus size={15} />{saving ? "Submitting..." : "Submit Complaint"}</ActionBtn>
          </form>
        </SectionCard>
        <SectionCard className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h4 className="font-bold text-slate-900">All Complaints</h4></div>
          <div className="max-h-[520px] divide-y divide-slate-100 overflow-auto">
            {records.length === 0 ? <EmptyState title="No complaints yet" desc="Submitted complaints appear here." /> : records.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{r.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Created {formatWhen(r.createdAt)} by {r.createdBy?.name || "User"}</p>
                    {r.updatedAt ? <p className="text-xs text-slate-500 mt-0.5">Last action {formatWhen(r.updatedAt)} - {statusText(r.status)}</p> : null}
                  </div>
                  <StatusPill status={r.status} priority={r.priority !== "NORMAL" ? r.priority : undefined} />
                </div>
                {r.description ? <p className="text-sm text-slate-600 mt-1">{r.description}</p> : null}
                {r.status !== "CLOSED" ? (
                  <div className="mt-3">
                    <ActionBtn variant="secondary" onClick={() => closeComplaint(r)}>Close Complaint</ActionBtn>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </section>
  );
}

const ANNOUNCEMENT_TYPES = ["General Notice", "Maintenance Schedule", "Event", "Emergency", "Rule Change", "Water Shutdown", "Power Outage", "Other"];

export function AnnouncementsPage({ session }) {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({ title: "", type: "General Notice", content: "", urgent: false });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await societyApi.operations(session.accessToken, "?limit=50");
      setRecords((data.records || data.operations || []).filter((r) => r.category === "Announcement"));
    } catch (err) {
      setError(err.message || "Unable to load announcements");
    }
  };

  useEffect(() => { load(); }, [session.accessToken]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await societyApi.createOperation(session.accessToken, {
        category: "Announcement",
        title: form.title,
        description: form.content,
        priority: form.urgent ? "HIGH" : "NORMAL",
        payload: { type: form.type, broadcast: "ALL" }
      });
      setStatus("Announcement published for all users.");
      setForm({ title: "", type: "General Notice", content: "", urgent: false });
      await load();
    } catch (err) {
      setError(err.message || "Unable to publish announcement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader eyebrow="Society Services" title="Announcements" description="Publish notices for all users." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <SectionCard className="p-6">
          <h3 className="font-bold text-slate-900">New Announcement</h3>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <label className="block"><FieldLabel>Title</FieldLabel><Input value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} required /></label>
            <label className="block"><FieldLabel>Type</FieldLabel><Select value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))}>{ANNOUNCEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></label>
            <label className="block"><FieldLabel>Content</FieldLabel><Textarea value={form.content} onChange={(v) => setForm((f) => ({ ...f, content: v }))} required /></label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.urgent} onChange={(e) => setForm((f) => ({ ...f, urgent: e.target.checked }))} />Mark urgent</label>
            <FormAlert type="error" msg={error} /><FormAlert type="success" msg={status} />
            <ActionBtn disabled={saving}><Bell size={14} />{saving ? "Publishing..." : "Publish Announcement"}</ActionBtn>
          </form>
        </SectionCard>
        <SectionCard className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h4 className="font-bold text-slate-900">Published Announcements</h4></div>
          <div className="max-h-[520px] divide-y divide-slate-100 overflow-auto">
            {records.length === 0 ? <EmptyState title="No announcements yet" desc="Published notices appear here." /> : records.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <p className="font-semibold text-slate-900 text-sm">{r.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{new Date(r.createdAt).toLocaleString()}</p>
                {r.description ? <p className="text-sm text-slate-600 mt-1">{r.description}</p> : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </section>
  );
}

export function DirectoryPage({ session }) {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({
    name: "",
    role: "Management Office",
    phone: "",
    altPhone: "",
    email: "",
    notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await societyApi.operations(session.accessToken, "?limit=200&category=Directory");
      setRecords((data.records || data.operations || []).filter((r) => /directory/i.test(r.category || "")));
    } catch (err) {
      setError(err.message || "Unable to load directory");
    }
  };

  useEffect(() => { load(); }, [session.accessToken]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await societyApi.createOperation(session.accessToken, {
        category: "Directory",
        title: `${form.role} - ${form.name}`,
        description: form.notes || `${form.name} (${form.role})`,
        priority: "NORMAL",
        payload: {
          name: form.name.trim(),
          role: form.role.trim(),
          phone: form.phone.trim(),
          altPhone: form.altPhone.trim(),
          email: form.email.trim(),
          notes: form.notes.trim()
        }
      });
      setStatus("Directory contact published.");
      setForm({ name: "", role: "Management Office", phone: "", altPhone: "", email: "", notes: "" });
      await load();
    } catch (err) {
      setError(err.message || "Unable to publish directory contact");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader eyebrow="Society Services" title="Society Directory" description="Publish global contacts that appear in resident mobile app." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <SectionCard className="p-6">
          <h3 className="font-bold text-slate-900">Add Directory Contact</h3>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><FieldLabel>Contact Name</FieldLabel><Input value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required /></label>
              <label className="block"><FieldLabel>Role / Department</FieldLabel><Input value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} required /></label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><FieldLabel>Primary Phone</FieldLabel><Input value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} required /></label>
              <label className="block"><FieldLabel>Alternate Phone</FieldLabel><Input value={form.altPhone} onChange={(v) => setForm((f) => ({ ...f, altPhone: v }))} /></label>
            </div>
            <label className="block"><FieldLabel>Email</FieldLabel><Input value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} type="email" /></label>
            <label className="block"><FieldLabel>Notes</FieldLabel><Textarea value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Office timing, escalation instructions, etc." /></label>
            <FormAlert type="error" msg={error} />
            <FormAlert type="success" msg={status} />
            <ActionBtn disabled={saving}><Plus size={14} />{saving ? "Publishing..." : "Publish Contact"}</ActionBtn>
          </form>
        </SectionCard>
        <SectionCard className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h4 className="font-bold text-slate-900">Published Contacts</h4></div>
          <div className="max-h-[520px] divide-y divide-slate-100 overflow-auto">
            {records.length === 0 ? <EmptyState title="No directory contacts yet" desc="Published contacts appear here." /> : records.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <p className="font-semibold text-slate-900 text-sm">{r.payload?.name || r.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.payload?.role || "Contact"}</p>
                <p className="text-sm text-slate-700 mt-1">{r.payload?.phone || "-"}</p>
                {r.payload?.altPhone ? <p className="text-xs text-slate-600 mt-0.5">Alt: {r.payload.altPhone}</p> : null}
                {r.payload?.email ? <p className="text-xs text-slate-600 mt-0.5">{r.payload.email}</p> : null}
                {r.payload?.notes ? <p className="text-sm text-slate-600 mt-1">{r.payload.notes}</p> : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </section>
  );
}

export function AmenitiesPage({ session }) {
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [amenityData, residentSuiteData] = await Promise.all([
        societyApi.operations(session.accessToken, "?limit=200&category=Amenity"),
        societyApi.operations(session.accessToken, "?limit=200&category=Resident%20Suite")
      ]);
      const allRecords = [
        ...(amenityData.records || amenityData.operations || []),
        ...(residentSuiteData.records || residentSuiteData.operations || [])
      ];
      const byId = new Map();
      allRecords.forEach((record) => {
        const payload = record.payload || {};
        const isAmenity =
          /amenity/i.test(record.category || "") ||
          /amenity/i.test(payload.feature || "") ||
          String(payload.requestType || "").toUpperCase() === "AMENITY_BOOKING";
        if (record.id && isAmenity) byId.set(record.id, record);
      });
      setRecords(Array.from(byId.values()));
    } catch (err) {
      setError(err.message || "Unable to load bookings");
    }
  };

  useEffect(() => { load(); }, [session.accessToken]);

  const pending = records.filter((r) => ["PENDING_APPROVAL", "OPEN", "IN_PROGRESS"].includes(r.status));
  const approved = records.filter((r) => r.status === "APPROVED");

  const decide = async (record, nextStatus) => {
    try {
      await societyApi.updateOperation(session.accessToken, record.id, { status: nextStatus });
      setStatus(`${record.title} -> ${nextStatus}`);
      await load();
    } catch (err) {
      setError(err.message || "Unable to update booking");
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader eyebrow="Society Services" title="Amenities Booking" description="Approve resident bookings and view globally blocked slots." />
      <FormAlert type="error" msg={error} />
      <FormAlert type="success" msg={status} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h4 className="font-bold text-slate-900">Pending Approvals</h4></div>
          <div className="max-h-[520px] divide-y divide-slate-100 overflow-auto">
            {pending.length === 0 ? <EmptyState title="No pending requests" desc="Residents have no pending bookings." /> : pending.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <p className="font-semibold text-slate-900 text-sm">{r.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.payload?.amenity} | {r.payload?.date} | {r.payload?.slot}</p>
                <div className="mt-3 flex gap-2">
                  <ActionBtn onClick={() => decide(r, "APPROVED")}><CheckCircle2 size={14} />Approve</ActionBtn>
                  <ActionBtn variant="danger" onClick={() => decide(r, "REJECTED")}><XCircle size={14} />Reject</ActionBtn>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h4 className="font-bold text-slate-900">Approved (Globally Blocked)</h4></div>
          <div className="max-h-[520px] divide-y divide-slate-100 overflow-auto">
            {approved.length === 0 ? <EmptyState title="No approved bookings" desc="Approved slots will appear here." /> : approved.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <p className="font-semibold text-slate-900 text-sm">{r.payload?.amenity || r.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.payload?.date} | {r.payload?.slot} | Flat {r.payload?.flatNumber || "N/A"}</p>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </section>
  );
}

const MAINTENANCE_CATS = ["Plumbing", "Electrical", "Lift / Elevator", "Common Area Cleaning", "Pest Control", "Painting", "Structural", "Intercom / CCTV", "Other"];
const URGENCY_OPTS = [{ value: "NORMAL", label: "Normal" }, { value: "HIGH", label: "Urgent" }, { value: "CRITICAL", label: "Emergency" }];
const MAINTENANCE_STATUS_OPTS = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "CLOSED", label: "Closed" }
];

export function MaintenancePage({ session }) {
  const isCorporate = session?.user?.company?.clientType === "CORPORATE";
  const serviceEyebrow = isCorporate ? "Corporate Services" : "Society Services";
  const unitNoun = isCorporate ? "office" : "flat";
  const unitArticle = isCorporate ? "an" : "a";
  const unitTitle = isCorporate ? "Office" : "Flat";
  const towerNoun = isCorporate ? "building" : "tower / wing";
  const towerTitle = isCorporate ? "Building" : "Tower";
  const maintenanceDescription = isCorporate
    ? "Raise requests office-wise, floor-wise, or building-wise."
    : "Raise requests flat-wise, floor-wise, or tower-wise.";
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    targetScope: "FLAT", branchId: "", tower: "", floor: "", flatId: "", category: "Plumbing", description: "", urgency: "NORMAL", location: ""
  });

  const { flats, branchOptions, towerOptions, floorOptions, flatOptions } = useFlatTargeting(session, form);

  const load = async () => {
    try {
      const data = await societyApi.operations(session.accessToken, "?category=Maintenance&limit=80");
      setRecords(operationRecords(data).filter((r) => r.category === "Maintenance"));
    } catch (err) {
      setError(err.message || "Unable to load maintenance requests");
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 25000);
    return () => clearInterval(timer);
  }, [session.accessToken]);

  const setMaintenanceStatus = async (record, nextStatus) => {
    setStatus("");
    setError("");
    try {
      const data = await societyApi.updateOperation(session.accessToken, record.id, { status: nextStatus });
      const updatedRecord = data.record || data.operation;
      if (updatedRecord) setRecords((current) => replaceRecord(current, updatedRecord));
      setStatus(`Maintenance request marked ${statusText(nextStatus)}.`);
    } catch (err) {
      setError(err.message || "Unable to update maintenance status");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const { selectedFlat, target } = buildTarget(form, flats);
      if (form.targetScope === "FLAT" && !selectedFlat) throw new Error(`Please select ${unitArticle} ${unitNoun}`);
      if (["FLOOR", "TOWER"].includes(form.targetScope) && !form.tower) throw new Error(`Please select a ${towerNoun}`);
      if (form.targetScope === "FLOOR" && !form.floor) throw new Error("Please select a floor");
      const label = form.targetScope === "FLAT" ? `${unitTitle} ${target.flatNumber || "Selected"}` : form.targetScope === "FLOOR" ? `${target.tower} Floor ${target.floor}` : `${target.tower} ${towerTitle}`;
      const data = await societyApi.createOperation(session.accessToken, {
        category: "Maintenance",
        title: `${form.category} - ${label}`,
        description: form.description,
        priority: form.urgency,
        payload: { category: form.category, location: form.location, targetScope: form.targetScope, target }
      });
      const createdRecord = data.record || data.operation;
      if (createdRecord) setRecords((current) => [createdRecord, ...current]);
      setStatus("Maintenance request submitted.");
      setForm({ targetScope: "FLAT", branchId: "", tower: "", floor: "", flatId: "", category: "Plumbing", description: "", urgency: "NORMAL", location: "" });
    } catch (err) {
      setError(err.message || "Unable to submit maintenance request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader eyebrow={serviceEyebrow} title="Maintenance Requests" description={maintenanceDescription} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <SectionCard className="p-6">
          <h3 className="font-bold text-slate-900">New Maintenance Request</h3>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <TargetingFields session={session} form={form} setForm={setForm} branchOptions={branchOptions} towerOptions={towerOptions} floorOptions={floorOptions} flatOptions={flatOptions} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><FieldLabel>Category</FieldLabel><Select value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))}>{MAINTENANCE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}</Select></label>
              <label className="block"><FieldLabel>Urgency</FieldLabel><Select value={form.urgency} onChange={(v) => setForm((f) => ({ ...f, urgency: v }))}>{URGENCY_OPTS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</Select></label>
            </div>
            <label className="block"><FieldLabel>Location Note</FieldLabel><Input value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} placeholder="e.g. Basement pump room" /></label>
            <label className="block"><FieldLabel>Description</FieldLabel><Textarea value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} required /></label>
            <FormAlert type="error" msg={error} /><FormAlert type="success" msg={status} />
            <ActionBtn disabled={saving}><Wrench size={14} />{saving ? "Submitting..." : "Submit Request"}</ActionBtn>
          </form>
        </SectionCard>
        <SectionCard className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h4 className="font-bold text-slate-900">All Maintenance Requests</h4></div>
          <div className="max-h-[520px] divide-y divide-slate-100 overflow-auto">
            {records.length === 0 ? <EmptyState title="No maintenance requests" desc="Submitted requests appear here." /> : records.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{r.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{new Date(r.createdAt).toLocaleString()}</p>
                    {r.description ? <p className="text-sm text-slate-600 mt-1">{r.description}</p> : null}
                  </div>
                  <StatusPill status={r.status} priority={r.priority !== "NORMAL" ? r.priority : undefined} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Status</span>
                  {["CLOSED", "RESOLVED"].includes(r.status) ? (
                    <span className="text-xs font-semibold text-slate-400">Final</span>
                  ) : (
                    <select
                      value={r.status === "WORKING" ? "IN_PROGRESS" : r.status}
                      onChange={(event) => setMaintenanceStatus(r, event.target.value)}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none"
                    >
                      {MAINTENANCE_STATUS_OPTS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </section>
  );
}

export function VotingSystemPage({ session }) {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({ topic: "", options: "Yes, No", endsAt: "" });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await societyApi.operations(session.accessToken, "?limit=120");
      const all = data.records || data.operations || [];
      setRecords(all.filter((record) => String(record.category || "").toLowerCase().includes("voting")));
    } catch (err) {
      setError(err.message || "Unable to load voting records");
    }
  };

  useEffect(() => { load(); }, [session.accessToken]);

  const createPoll = async (event) => {
    event.preventDefault();
    const topic = form.topic.trim();
    const options = form.options.split(",").map((item) => item.trim()).filter(Boolean);
    if (!topic || options.length < 2) {
      setError("Enter poll topic and at least 2 options.");
      return;
    }

    const votes = options.reduce((acc, option) => ({ ...acc, [option]: 0 }), {});
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const endsAt = toIsoDateTimeOrEmpty(form.endsAt);
      await societyApi.createOperation(session.accessToken, {
        category: "Voting",
        title: `Voting Poll - ${topic}`,
        description: "Society voting poll",
        status: "OPEN",
        priority: "NORMAL",
        dueAt: endsAt || undefined,
        payload: {
          feature: "Voting System",
          topic,
          options,
          votes,
          votedBy: [],
          endsAt: endsAt || "",
          createdBy: session.user.id
        }
      });
      setStatus("Poll created successfully.");
      setForm({ topic: "", options: "Yes, No", endsAt: "" });
      await load();
    } catch (err) {
      setError(err.message || "Unable to create poll");
    } finally {
      setSaving(false);
    }
  };

  const castVote = async (record, option) => {
    const payload = record.payload || {};
    const votedBy = Array.isArray(payload.votedBy) ? payload.votedBy : [];
    if (votedBy.includes(session.user.id)) {
      setStatus("You already voted in this poll.");
      return;
    }
    const votes = payload.votes && typeof payload.votes === "object" ? payload.votes : {};
    const nextVotes = { ...votes, [option]: Number(votes[option] || 0) + 1 };
    try {
      await societyApi.updateOperation(session.accessToken, record.id, {
        payload: {
          ...payload,
          votes: nextVotes,
          votedBy: [...votedBy, session.user.id],
          lastVoteAt: new Date().toISOString()
        }
      });
      setStatus(`Vote submitted for ${option}.`);
      await load();
    } catch (err) {
      setError(err.message || "Unable to submit vote");
    }
  };

  const closePoll = async (record) => {
    try {
      await societyApi.updateOperation(session.accessToken, record.id, { status: "CLOSED" });
      setStatus("Poll closed.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to close poll");
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader eyebrow="Society Services" title="Voting System" description="Create society polls and collect resident votes." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <SectionCard className="p-6">
          <h3 className="font-bold text-slate-900">Create Poll</h3>
          <form onSubmit={createPoll} className="mt-4 space-y-4">
            <label className="block"><FieldLabel>Poll Topic</FieldLabel><Input value={form.topic} onChange={(value) => setForm((current) => ({ ...current, topic: value }))} placeholder="e.g. Clubhouse timing change" required /></label>
            <label className="block"><FieldLabel>Options</FieldLabel><Input value={form.options} onChange={(value) => setForm((current) => ({ ...current, options: value }))} placeholder="Yes, No, Abstain" required /></label>
            <label className="block"><FieldLabel>Voting Limit</FieldLabel><Input value={form.endsAt} onChange={(value) => setForm((current) => ({ ...current, endsAt: value }))} type="datetime-local" /></label>
            <FormAlert type="error" msg={error} />
            <FormAlert type="success" msg={status} />
            <ActionBtn disabled={saving}><Plus size={14} />{saving ? "Creating..." : "Create Poll"}</ActionBtn>
          </form>
        </SectionCard>
        <SectionCard className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h4 className="font-bold text-slate-900">Polls</h4></div>
          <div className="max-h-[520px] divide-y divide-slate-100 overflow-auto">
            {records.length === 0 ? <EmptyState title="No polls yet" desc="Create a poll to start voting." /> : records.map((record) => {
              const options = Array.isArray(record.payload?.options) ? record.payload.options : [];
              const votes = record.payload?.votes && typeof record.payload.votes === "object" ? record.payload.votes : {};
              const votedBy = Array.isArray(record.payload?.votedBy) ? record.payload.votedBy : [];
              const hasVoted = votedBy.includes(session.user.id);
              const totalVotes = Object.values(votes).reduce((sum, value) => sum + Number(value || 0), 0);
              const endsAt = record.payload?.endsAt || record.dueAt;
              const isExpired = endsAt ? new Date(endsAt).getTime() < Date.now() : false;
              const isClosed = record.status === "CLOSED" || isExpired;
              return (
                <div key={record.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{record.payload?.topic || record.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Total votes: {totalVotes}</p>
                      {endsAt ? <p className="text-xs text-slate-500 mt-0.5">Voting limit: {new Date(endsAt).toLocaleString()}</p> : null}
                    </div>
                    <StatusPill status={record.status} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {options.map((option) => (
                      <div key={`${record.id}-${option}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                        <p className="text-sm text-slate-700">{option} <span className="text-slate-400">({Number(votes[option] || 0)})</span></p>
                        <ActionBtn variant="secondary" disabled={hasVoted || isClosed} onClick={() => castVote(record, option)}>
                          {hasVoted || isClosed ? "Locked" : "Vote"}
                        </ActionBtn>
                      </div>
                    ))}
                  </div>
                  {!isClosed ? (
                    <div className="mt-3">
                      <ActionBtn variant="secondary" onClick={() => closePoll(record)}>Close Poll</ActionBtn>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </section>
  );
}

export function MaintenanceBillingPage({ session }) {
  const isCorporate = session?.user?.company?.clientType === "CORPORATE";
  const serviceEyebrow = isCorporate ? "Corporate Services" : "Society Services";
  const unitNoun = isCorporate ? "office" : "flat";
  const unitTitle = isCorporate ? "Office" : "Flat";
  const unitBillingDescription = isCorporate
    ? "Create monthly maintenance bills and track office payment status."
    : "Create monthly maintenance bills and track payment status.";
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({ targetScope: "FLAT", branchId: "", tower: "", floor: "", flatId: "", month: "", amount: "", dueDate: "", reference: "" });
  const [denyNotes, setDenyNotes] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const { flats, branchOptions, towerOptions, floorOptions, flatOptions } = useFlatTargeting(session, form);

  const load = async () => {
    try {
      const data = await societyApi.operations(session.accessToken, "?category=Maintenance%20Billing&limit=150");
      const all = operationRecords(data);
      setRecords(all.filter((record) => String(record.category || "").toLowerCase().includes("maintenance billing")));
    } catch (err) {
      setError(err.message || "Unable to load maintenance billing");
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [session.accessToken]);

  const createBill = async (event) => {
    event.preventDefault();
    const month = form.month.trim();
    const amount = Number(form.amount);
    if (!month || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter billing month and valid amount.");
      return;
    }
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const { selectedFlat, target } = buildTarget({ ...form, targetScope: "FLAT" }, flats);
      if (!selectedFlat) throw new Error(`Please select the ${unitNoun} for this bill.`);
      const data = await societyApi.createOperation(session.accessToken, {
        category: "Maintenance Billing",
        title: `Maintenance Bill - ${month} - ${unitTitle} ${target.flatNumber}`,
        description: `Monthly maintenance billing for ${unitTitle} ${target.flatNumber}`,
        branchId: target.branchId || undefined,
        status: "OPEN",
        priority: "NORMAL",
        payload: {
          feature: "Maintenance Billing",
          month,
          amount,
          dueDate: form.dueDate.trim(),
          reference: form.reference.trim(),
          targetScope: "FLAT",
          target,
          flatId: target.flatId,
          flatNumber: target.flatNumber,
          tower: target.tower,
          floor: target.floor,
          branchId: target.branchId,
          billState: "UNPAID"
        }
      });
      const createdRecord = data.record || data.operation;
      if (createdRecord) setRecords((current) => [createdRecord, ...current]);
      setStatus("Maintenance bill added.");
      setForm({ targetScope: "FLAT", branchId: "", tower: "", floor: "", flatId: "", month: "", amount: "", dueDate: "", reference: "" });
    } catch (err) {
      setError(err.message || "Unable to create maintenance bill");
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (record) => {
    try {
      const data = await societyApi.updateOperation(session.accessToken, record.id, {
        status: "RESOLVED",
        payload: {
          ...(record.payload || {}),
          billState: "PAID",
          paidAt: new Date().toISOString(),
          adminVerifiedAt: new Date().toISOString(),
          adminVerifiedBy: session.user.id
        }
      });
      const updatedRecord = data.record || data.operation;
      if (updatedRecord) setRecords((current) => replaceRecord(current, updatedRecord));
      setStatus("Bill marked paid.");
    } catch (err) {
      setError(err.message || "Unable to update bill status");
    }
  };

  const denyPayment = async (record) => {
    const note = String(denyNotes[record.id] || "").trim();
    if (!note) {
      setError("Enter a denial note before denying payment.");
      return;
    }
    try {
      const data = await societyApi.updateOperation(session.accessToken, record.id, {
        status: "OPEN",
        payload: {
          ...(record.payload || {}),
          billState: "UNPAID",
          paymentDeniedNote: note,
          paymentDeniedAt: new Date().toISOString(),
          paymentDeniedBy: session.user.id
        }
      });
      const updatedRecord = data.record || data.operation;
      if (updatedRecord) setRecords((current) => replaceRecord(current, updatedRecord));
      setStatus("Payment denied with note.");
      setDenyNotes((current) => ({ ...current, [record.id]: "" }));
    } catch (err) {
      setError(err.message || "Unable to deny payment");
    }
  };

  const stats = useMemo(() => {
    const total = records.reduce((sum, record) => sum + Number(record.payload?.amount || 0), 0);
    const paid = records
      .filter((record) => record.status === "RESOLVED" || record.payload?.billState === "PAID")
      .reduce((sum, record) => sum + Number(record.payload?.amount || 0), 0);
    return { total, paid, unpaid: Math.max(0, total - paid) };
  }, [records]);

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow={serviceEyebrow}
        title="Maintenance Billing"
        description={unitBillingDescription}
        stats={[
          { label: "Total (INR)", value: stats.total.toLocaleString() },
          { label: "Paid (INR)", value: stats.paid.toLocaleString() },
          { label: "Unpaid (INR)", value: stats.unpaid.toLocaleString() }
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <SectionCard className="p-6">
          <h3 className="font-bold text-slate-900">Add Monthly Bill</h3>
          <form onSubmit={createBill} className="mt-4 space-y-4">
            <TargetingFields session={session} form={form} setForm={setForm} branchOptions={branchOptions} towerOptions={towerOptions} floorOptions={floorOptions} flatOptions={flatOptions} showScope={false} />
            <label className="block"><FieldLabel>Billing Month</FieldLabel><Input value={form.month} onChange={(value) => setForm((current) => ({ ...current, month: value }))} placeholder="e.g. May 2026" required /></label>
            <label className="block"><FieldLabel>Amount (INR)</FieldLabel><Input value={form.amount} onChange={(value) => setForm((current) => ({ ...current, amount: value }))} type="number" required /></label>
            <label className="block"><FieldLabel>Due Date</FieldLabel><Input value={form.dueDate} onChange={(value) => setForm((current) => ({ ...current, dueDate: value }))} type="date" /></label>
            <label className="block"><FieldLabel>Reference</FieldLabel><Textarea value={form.reference} onChange={(value) => setForm((current) => ({ ...current, reference: value }))} placeholder="Optional notes or payment reference" rows={3} /></label>
            <FormAlert type="error" msg={error} />
            <FormAlert type="success" msg={status} />
            <ActionBtn disabled={saving}><Plus size={14} />{saving ? "Saving..." : "Add Bill"}</ActionBtn>
          </form>
        </SectionCard>
        <SectionCard className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h4 className="font-bold text-slate-900">Billing Records</h4></div>
          <div className="max-h-[520px] divide-y divide-slate-100 overflow-auto">
            {records.length === 0 ? <EmptyState title="No maintenance bills yet" desc="Added bills will appear here." /> : records.map((record) => {
              const amount = Number(record.payload?.amount || 0);
              const isPaid = record.status === "RESOLVED" || record.payload?.billState === "PAID";
              const isPaymentReported = record.status === "PENDING_APPROVAL" || record.payload?.billState === "PAYMENT_REPORTED";
              return (
                <div key={record.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{record.payload?.month || record.title}</p>
                      <p className="text-sm text-slate-600 mt-1">INR {amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{unitTitle}: {record.payload?.target?.flatNumber || record.payload?.flatNumber || "-"}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Due: {record.payload?.dueDate || "-"}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Admin added: {formatWhen(record.createdAt)}</p>
                      {record.payload?.reportedPaidAt ? <p className="text-xs text-slate-500 mt-0.5">{unitTitle} submitted paid date: {formatWhen(record.payload.reportedPaidAt)}</p> : null}
                      {record.payload?.paidDate ? <p className="text-xs text-slate-500 mt-0.5">Paid date selected: {record.payload.paidDate}</p> : null}
                      {record.payload?.adminVerifiedAt ? <p className="text-xs text-slate-500 mt-0.5">Admin verified: {formatWhen(record.payload.adminVerifiedAt)}</p> : null}
                      {record.payload?.paymentDeniedNote ? <p className="text-xs text-red-600 mt-0.5">Last denial: {record.payload.paymentDeniedNote}</p> : null}
                    </div>
                    <StatusPill status={isPaid ? "PAID" : isPaymentReported ? "PENDING VERIFICATION" : "UNPAID"} />
                  </div>
                  {isPaymentReported ? (
                    <div className="mt-3 space-y-3">
                      <Textarea
                        value={denyNotes[record.id] || ""}
                        onChange={(value) => setDenyNotes((current) => ({ ...current, [record.id]: value }))}
                        placeholder="Denial note if payment is not received"
                        rows={2}
                      />
                      <div className="flex flex-wrap gap-2">
                        <ActionBtn onClick={() => markPaid(record)}>Confirm Paid</ActionBtn>
                        <ActionBtn variant="danger" onClick={() => denyPayment(record)}>Deny Payment</ActionBtn>
                      </div>
                    </div>
                  ) : !isPaid ? (
                    <div className="mt-3">
                      <ActionBtn onClick={() => markPaid(record)}>Mark Paid</ActionBtn>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </section>
  );
}
