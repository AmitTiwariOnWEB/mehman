import { AlertTriangle, Bell, Building2, CreditCard, Download, Eye, EyeOff, Home, Plus, Save, Search, Settings, ShieldCheck, UsersRound } from "lucide-react";
import { lazy, useEffect, useMemo, useState } from "react";
import { societyApi } from "../lib/api";
import { getClientTerms, getRoleLabel } from "../lib/clientTerminology";
import { DashboardChart } from "./DashboardChart";
import { GatepassesPage, VisitorsPage } from "./GatepassPages";
import { MetricCard } from "./MetricCard";
import { OperationsConsole } from "./OperationsConsole";
import { GatesAndTowers, SocietyUsers } from "./SocietyAdminPages";
import { StatusPill, WorkflowHeader } from "./WorkflowPrimitives";

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const CORPORATE_DISABLED_FEATURES = new Set(["Amenities Booking", "Voting System"]);
const lazyNamed = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

const AmenitiesPage = lazyNamed(() => import("./ServicePages"), "AmenitiesPage");
const AnnouncementsPage = lazyNamed(() => import("./ServicePages"), "AnnouncementsPage");
const ComplaintsPage = lazyNamed(() => import("./ServicePages"), "ComplaintsPage");
const DirectoryPage = lazyNamed(() => import("./ServicePages"), "DirectoryPage");
const MaintenanceBillingPage = lazyNamed(() => import("./ServicePages"), "MaintenanceBillingPage");
const MaintenancePage = lazyNamed(() => import("./ServicePages"), "MaintenancePage");
const NotificationsInbox = lazyNamed(() => import("./ServicePages"), "NotificationsInbox");
const VotingSystemPage = lazyNamed(() => import("./ServicePages"), "VotingSystemPage");

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  // ﻿ = UTF-8 BOM so Excel opens without garbled characters
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
const parseReportPayload = (payload) => {
  if (!payload) return {};
  if (typeof payload === "object" && !Array.isArray(payload)) return payload;
  if (typeof payload !== "string") return {};
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};
const isStaffCardRecord = (record) => {
  const payload = parseReportPayload(record?.payload);
  return (
    record?.title === "Staff ID Card" ||
    record?.title === "Maid & Driver ID Card" ||
    payload.feature === "Staff ID Cards" ||
    payload.feature === "Maid & Driver IDs" ||
    /resident staff/i.test(record?.category || "")
  );
};
const toReportDateRange = (fromDate, toDate) => ({
  start: new Date(`${fromDate}T00:00:00`),
  end: new Date(`${toDate}T23:59:59.999`)
});
const isWithinReportRange = (value, range) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= range.start && date <= range.end;
};
const getStaffName = (record, payload) =>
  payload.staffName || payload.fullName || payload.name || record?.submittedBy?.name || record?.createdBy?.name || "";
const getStaffAttendanceRows = (records, fromDate, toDate, fmtDate, fmtTime) => {
  const range = toReportDateRange(fromDate, toDate);
  return records.filter(isStaffCardRecord).flatMap((record) => {
    const payload = parseReportPayload(record.payload);
    const base = [
      getStaffName(record, payload),
      payload.designation || payload.staffDesignation || payload.staffRole || "",
      payload.staffIdNumber || payload.idNumber || "",
      payload.flatNumber || payload.flat || payload.unitNumber || ""
    ];
    const currentState = payload.entryState || (record.status === "IN_PROGRESS" ? "CHECKED_IN" : record.status === "CANCELLED" ? "DENIED" : "PENDING");
    const eventRows = Array.isArray(payload.attendanceLogs)
      ? payload.attendanceLogs
          .filter((event) => isWithinReportRange(event?.occurredAt, range))
          .map((event) => [
            ...base,
            event.action === "CHECKED_IN" ? "Check-In" : event.action === "CHECKED_OUT" ? "Check-Out" : event.action === "DENIED" ? "Denied" : event.action || "",
            fmtDate(event.occurredAt),
            fmtTime(event.occurredAt),
            event.actionBy || event.guardName || payload.lastActionBy || "",
            currentState,
            payload.cardNumber || "",
            fmtDate(record.createdAt)
          ])
      : [];
    if (eventRows.length) return eventRows;
    return [
      payload.checkedInAt,
      payload.checkedOutAt,
      currentState === "DENIED" ? payload.lastActionAt : null
    ].filter((value) => isWithinReportRange(value, range)).map((value) => [
      ...base,
      value === payload.checkedInAt ? "Check-In" : value === payload.checkedOutAt ? "Check-Out" : "Denied",
      fmtDate(value),
      fmtTime(value),
      payload.lastActionBy || "",
      currentState,
      payload.cardNumber || "",
      fmtDate(record.createdAt)
    ]);
  });
};
const pickImageCandidate = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const nested = pickImageCandidate(value.url, value.uri, value.src, value.image, value.imageUrl, value.qrImageDataUrl);
      if (nested) return nested;
    }
  }
  return "";
};
const normalizeImageSource = (value) => {
  const raw = pickImageCandidate(value);
  if (!raw) return "";
  if (raw.startsWith("data:image/") || raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("blob:") || raw.startsWith("/")) {
    return raw;
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(raw) && raw.length > 100) {
    return `data:image/png;base64,${raw.replace(/\s/g, "")}`;
  }
  return "";
};
const getGatepassQrEndpoint = (gatepass) => gatepass?.id ? `/api/gatepasses/${gatepass.id}/qr` : "";
const getGatepassQrImage = (gatepass) =>
  getGatepassQrEndpoint(gatepass) || normalizeImageSource(
    pickImageCandidate(
      gatepass?.qrImageDataUrl,
      gatepass?.qrCodeDataUrl,
      gatepass?.qrCodeImageDataUrl,
      gatepass?.qrImageUrl,
      gatepass?.qrCodeUrl,
      gatepass?.qrUrl,
      gatepass?.metadata?.qrImageDataUrl,
      gatepass?.metadata?.qrCodeDataUrl,
      gatepass?.metadata?.qrImageUrl,
      gatepass?.metadata?.qrImage
    )
  );
const getVisitorImage = (visitor) =>
  normalizeImageSource(
    pickImageCandidate(
      visitor?.photoUrl,
      visitor?.gatepasses?.[0]?.metadata?.visitorPhotoUrl,
      visitor?.gatepasses?.[0]?.metadata?.photoUrl
    )
  );
function SafeThumb({ src, alt, className, fallback }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback || null;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

function DashboardOverview({ session }) {
  const terms = getClientTerms(session);
  const [analytics, setAnalytics] = useState(null);
  const [operations, setOperations] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [error, setError] = useState("");
  const [trendRange, setTrendRange] = useState("weekly");

  const trendOptions = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "last_3_months", label: "Last 3 months" }
  ];

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!analytics || downloading) return;
    setDownloading(true);
    try {
      const now = new Date();
      const generatedAt = now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
      const periodLabel = trendOptions.find((o) => o.value === trendRange)?.label ?? trendRange;
      const filename = `Mehman-Report-${periodLabel.replace(/\s+/g, "-")}-${now.toISOString().slice(0, 10)}.csv`;

      const fromDate = trendRange === "daily"
        ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString().slice(0, 10)
        : trendRange === "weekly"
          ? new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
          : trendRange === "monthly"
            ? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
            : new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().slice(0, 10);

      const toDate = now.toISOString().slice(0, 10);

      // Fetch visitors + entry/exit logs in parallel
      const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" });
      const fmtTime = (d) => new Date(d).toLocaleTimeString("en-IN", { timeStyle: "short" });

      const [visitorData, logData, staffData] = await Promise.all([
        societyApi.visitors(session.accessToken, `?limit=2000&from=${fromDate}`),
        societyApi.entryLogs(session.accessToken, `?from=${fromDate}&to=${toDate}&limit=5000`),
        societyApi.operations(session.accessToken, "?limit=5000&category=Resident%20Staff")
      ]);

      const allVisitors = visitorData.visitors || [];
      const allLogs = logData.logs || [];
      const allOps = staffData.operations || staffData.records || [];
      const staffAttendanceRows = getStaffAttendanceRows(allOps, fromDate, toDate, fmtDate, fmtTime);

      const rows = [
        ["VISITOR PASSES"],
        [],
        ["Visitor", "Phone", "Purpose", "Gate", "Vehicle", "Pass", "Status", "Date", "Time"],
        ...allVisitors.map((v) => {
          const pass = v.gatepasses?.[0];
          const vehicle = v.vehicles?.[0];
          return [v.fullName ?? "", v.phone ?? "", v.purpose ?? "", v.branch?.name ?? pass?.metadata?.gateName ?? "", vehicle?.number ?? "", pass?.passCode ?? "", pass?.status ?? "", fmtDate(v.createdAt), fmtTime(v.createdAt)];
        }),
        [],
        ["VISITOR CHECK-IN / CHECK-OUT LOG"],
        [],
        ["Visitor", "Phone", "Pass", "Action", "Gate", "Vehicle", "Logged By", "Role", "Date", "Time"],
        ...allLogs.map((log) => {
          const v = log.gatepass?.visitor;
          const vehicle = log.gatepass?.vehicle;
          return [v?.fullName ?? log.snapshot?.visitorName ?? "", v?.phone ?? "", log.gatepass?.passCode ?? log.snapshot?.passCode ?? "", log.action === "ENTRY" ? "Check-In" : log.action === "EXIT" ? "Check-Out" : log.action, log.branch?.name ?? "", vehicle?.number ?? "", log.loggedBy?.name ?? "", log.loggedBy?.role?.name ?? "", fmtDate(log.occurredAt), fmtTime(log.occurredAt)];
        }),
        [],
        ["HOUSEHOLD STAFF ATTENDANCE (Maid / Driver / Domestic)"],
        [],
        ["Staff Name", "Designation", "ID Number", "Flat", "Action", "Date", "Time", "Actioned By", "Current State", "Card No", "Date Added"],
        ...staffAttendanceRows
      ];

      downloadCsv(filename, rows);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const [analyticsData, opsData, visitorsData] = await Promise.all([
          societyApi.analytics(session.accessToken, `?range=${trendRange}`),
          societyApi.operations(session.accessToken, "?limit=80"),
          societyApi.visitors(session.accessToken, "?limit=80")
        ]);
        setAnalytics(analyticsData);
        setOperations(opsData.operations || opsData.records || []);
        setVisitors(visitorsData.visitors || []);
      } catch (err) {
        setError(err.message || "Unable to load dashboard");
      }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [session.accessToken, trendRange]);

  const periodLabel = trendOptions.find((o) => o.value === trendRange)?.label ?? trendRange;
  const cardPeriodLabel = trendRange === "daily" ? "Today" : periodLabel;
  const metrics = [
    { label: "Total Visitors", value: analytics?.cards?.totalVisitors ?? 0, delta: cardPeriodLabel, tone: "teal" },
    { label: "Active Inside", value: analytics?.cards?.activeVisitors ?? 0, delta: "Current passes (live)", tone: "blue" },
    { label: "Entries", value: analytics?.cards?.entryLogs ?? 0, delta: cardPeriodLabel, tone: "emerald" },
    { label: "Exits", value: analytics?.cards?.exitLogs ?? 0, delta: cardPeriodLabel, tone: "amber" }
  ];

  const openOperations = operations.filter((item) => ["OPEN", "WORKING", "IN_PROGRESS", "PENDING_APPROVAL"].includes(item.status));
  const paymentReviews = operations.filter((item) =>
    String(item.category || "").toLowerCase().includes("maintenance billing") &&
    (item.status === "PENDING_APPROVAL" || item.payload?.billState === "PAYMENT_REPORTED")
  );
  const pendingVisitors = visitors.filter((visitor) =>
    visitor.gatepasses?.some((pass) => ["DRAFT", "PENDING"].includes(pass.status))
  );
  const emergencies = operations.filter((item) =>
    /emergency|sos/i.test(`${item.category || ""} ${item.title || ""}`) &&
    ["OPEN", "WORKING", "IN_PROGRESS", "PENDING_APPROVAL"].includes(item.status)
  );

  const commandRows = [
    {
      title: "Approvals waiting",
      value: pendingVisitors.length,
      detail: "Visitor and delivery decisions that need action",
      Icon: ShieldCheck,
      tone: "blue"
    },
    {
      title: "Open service desk",
      value: openOperations.length,
      detail: "Complaints, maintenance, facility and resident requests",
      Icon: Settings,
      tone: "slate"
    },
    {
      title: "Payment reviews",
      value: paymentReviews.length,
      detail: "Maintenance payment proofs awaiting verification",
      Icon: CreditCard,
      tone: "amber"
    },
    {
      title: "Emergency alerts",
      value: emergencies.length,
      detail: "SOS or critical incidents requiring response",
      Icon: AlertTriangle,
      tone: "red"
    }
  ];

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow={terms.adminRole}
        title="Command center"
        description="Live visitor, gatepass, service, payment, and emergency activity for daily operations."
        stats={[
          { label: "Pending", value: pendingVisitors.length },
          { label: "Open Ops", value: openOperations.length },
          { label: "SOS", value: emergencies.length }
        ]}
      />
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-3 lg:grid-cols-4">
        {commandRows.map(({ title, value, detail, Icon, tone }) => (
          <section key={title} className={`rounded-2xl border bg-white p-4 shadow-sm ${
            tone === "red" ? "border-red-100" : tone === "amber" ? "border-amber-100" : "border-slate-200"
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                tone === "red" ? "bg-red-50 text-red-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
              }`}>
                <Icon size={17} />
              </span>
            </div>
            <p className="mt-4 tabular-nums text-3xl font-black text-slate-950">{value}</p>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {trendOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTrendRange(option.value)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                trendRange === option.value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!analytics || downloading}
          className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
        >
          <Download size={13} />
          {downloading ? "Preparing…" : "Download Report"}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_.6fr]">
        <DashboardChart trend={analytics?.trend || []} trendLabel={analytics?.trendLabel || "Last 7 days"} />
        <section className="panel rounded-2xl p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <Bell size={17} />
            </span>
            <div>
              <h3 className="font-bold text-slate-950">Recent operations</h3>
              <p className="text-xs text-slate-500">Latest records needing attention</p>
            </div>
          </div>
          <div className="space-y-3">
            {openOperations.slice(0, 5).length === 0 ? (
              <p className="text-sm text-slate-500">No open operations right now.</p>
            ) : openOperations.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{item.category} - {item.status}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function useSocietyDirectory(session) {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setError("");
      const [userData, branchData] = await Promise.all([
        societyApi.users(session.accessToken),
        societyApi.branches(session.accessToken)
      ]);
      setUsers(userData.users || []);
      setBranches(branchData.branches || []);
    } catch (err) {
      setError(err.message || "Unable to load records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session.accessToken]);

  return { users, branches, error, loading, load };
}

function ResidentManagement({ session }) {
  const terms = getClientTerms(session);
  const [flats, setFlats]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [status, setStatus]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    name: "", email: "", phone: "",
    password: "", flatNumber: "", tower: "", floor: "", flatId: ""
  });

  const load = async () => {
    try {
      setError("");
      const fData = await societyApi.flats(session.accessToken);
      setFlats(fData.flats || []);
    } catch (err) {
      setError(err.message || "Unable to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session.accessToken]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  /* Derive owner counts directly from flat.owner / flat.owner2 returned by API */
  const selectedFlat    = flats.find((f) => f.id === form.flatId);
  const selectedOwners  = selectedFlat ? [selectedFlat.owner, selectedFlat.owner2].filter(Boolean) : [];
  const flatFull        = selectedOwners.length >= 2;

  const occupiedCount   = flats.filter((f) => f.owner || f.owner2).length;
  const totalResidents  = flats.reduce((n, f) => n + [f.owner, f.owner2].filter(Boolean).length, 0);

  /* When user picks a flat from the dropdown, auto-fill tower/floor */
  const pickFlat = (flatId) => {
    const flat = flats.find((f) => f.id === flatId);
    if (!flat) { update("flatId", ""); return; }
    setForm((f) => ({ ...f, flatId: flat.id, flatNumber: flat.flatNumber, tower: flat.tower || "", floor: flat.floor || "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (flatFull) { setError(`This ${terms.unitLower} already has 2 ${terms.residentLower} IDs. Remove one before adding another.`); return; }
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await societyApi.createUser(session.accessToken, {
        role: "FLAT_OWNER",
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        flatNumber: form.flatNumber,
        tower: form.tower || undefined,
        floor: form.floor || undefined
      });
      setStatus(`${terms.resident} login created for ${terms.unitLower} ${form.flatNumber}.`);
      setForm((c) => ({ ...c, name: "", email: "", phone: "", flatId: "" }));
      await load();
    } catch (err) {
      setError(err.message || `Unable to create ${terms.residentLower}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader eyebrow={terms.residentPlural} title={`${terms.resident} management`} description={`Create up to 2 login IDs per ${terms.unitLower}. Both IDs share the same ${terms.unitLower} - either can approve visitors.`} stats={[
        { label: terms.residentPlural, value: totalResidents },
        { label: `${terms.unitPlural} occupied`, value: occupiedCount },
        { label: `Max IDs/${terms.unitLower}`, value: "2" }
      ]} />
      {error  ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {status ? <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{status}</p> : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_.9fr]">
        <form onSubmit={submit} className="panel rounded-xl p-6">
          <div className="mb-5 flex items-center gap-3">
            <UsersRound className="text-blue-700" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Create {terms.resident} Login</h3>
              <p className="text-sm text-slate-500">Max 2 IDs per {terms.unitLower} - both get same access.</p>
            </div>
          </div>

          {/* Flat picker */}
          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-700">Select {terms.unit}</span>
            <select value={form.flatId} onChange={(e) => pickFlat(e.target.value)} className="field-glass mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none focus:border-blue-500">
              <option value="">- pick from existing {terms.unitPluralLower} -</option>
              {flats.map((flat) => {
                const flatOwners = [flat.owner, flat.owner2].filter(Boolean);
                return (
                  <option key={flat.id} value={flat.id} disabled={flatOwners.length >= 2}>
                    {flat.flatNumber}{flat.tower ? ` (${flat.tower})` : ""}  | {flatOwners.length}/2 IDs{flatOwners.length >= 2 ? " FULL" : ""}
                  </option>
                );
              })}
            </select>
          </label>

          {flatFull ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This {terms.unitLower} already has 2 {terms.residentLower} IDs. Remove one before adding another.
            </div>
          ) : null}

          {selectedOwners.length > 0 ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Existing ID{selectedOwners.length > 1 ? "s" : ""}: <strong>{selectedOwners.map((o) => o.name).join(", ")}</strong>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Full Name" value={form.name} onChange={(v) => update("name", v)} required />
            <Input label="Email" value={form.email} onChange={(v) => update("email", v)} type="email" required />
            <Input label="Phone" value={form.phone} onChange={(v) => update("phone", v)} />
            <Input label="Password" value={form.password} onChange={(v) => update("password", v)} type="password" required />
            <Input label={`${terms.unit} Number`} value={form.flatNumber} onChange={(v) => update("flatNumber", v)} required />
            <Input label={terms.tower} value={form.tower} onChange={(v) => update("tower", v)} />
            <Input label="Floor" value={form.floor} onChange={(v) => update("floor", v)} />
          </div>

          <button disabled={saving || flatFull} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
            <Plus size={17} /> {saving ? "Creating..." : `Create ${terms.resident} Login`}
          </button>
        </form>

        {/* Residents list grouped by flat */}
        <div className="panel rounded-xl p-0">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-semibold text-slate-950">{terms.residentPlural} by {terms.unit}</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-auto">
            {loading ? <p className="p-5 text-sm text-slate-500">Loading...</p> :
              flats.filter((f) => f.owner || f.owner2).length === 0
                ? <p className="p-5 text-sm text-slate-500">No {terms.residentPluralLower} yet.</p>
                : flats.filter((f) => f.owner || f.owner2).map((flat) => {
                    const owners = [flat.owner, flat.owner2].filter(Boolean);
                    return (
                      <div key={flat.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-slate-950">{terms.unit} {flat.flatNumber}{flat.tower ? `  | ${flat.tower}` : ""}</p>
                          <span className={`rounded-xl px-2 py-0.5 text-xs font-bold ${owners.length >= 2 ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                            {owners.length}/2 IDs
                          </span>
                        </div>
                        {owners.map((owner) => (
                          <div key={owner.id} className="flex items-center gap-2 mt-1.5">
                            <div className="h-6 w-6 shrink-0 rounded-md bg-blue-100 grid place-items-center text-[10px] font-bold text-blue-700">
                              {owner.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{owner.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })
            }
          </div>
        </div>
      </section>
    </section>
  );
}


function FlatsAndTowers({ session }) {
  const terms = getClientTerms(session);
  const [allFlats, setAllFlats]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [status, setStatus]       = useState("");

  const [singleForm, setSingleForm] = useState({ flatNumber: "", tower: "", floor: "" });
  const [singleSaving, setSingleSaving] = useState(false);

  const load = async () => {
    try {
      setError("");
      const fData = await societyApi.flats(session.accessToken);
      setAllFlats(fData.flats || []);
    } catch (err) {
      setError(err.message || "Unable to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session.accessToken]);

  const updateSingle = (k, v) => setSingleForm((f) => ({ ...f, [k]: v }));

  const singleCreate = async (e) => {
    e.preventDefault();
    setSingleSaving(true);
    setStatus(""); setError("");
    try {
      await societyApi.createFlat(session.accessToken, {
        flatNumber: singleForm.flatNumber.trim(),
        tower:      singleForm.tower.trim() || undefined,
        floor:      singleForm.floor.trim() || undefined,
        isActive:   true
      });
      setStatus(`${terms.unit} ${singleForm.flatNumber} created.`);
      setSingleForm({ flatNumber: "", tower: "", floor: "" });
      await load();
    } catch (err) {
      setError(err.message || `Unable to create ${terms.unitLower}`);
    } finally {
      setSingleSaving(false);
    }
  };

  const toggleActive = async (flat) => {
    setError(""); setStatus("");
    try {
      await societyApi.updateFlat(session.accessToken, flat.id, { isActive: !flat.isActive });
      setStatus(`${terms.unit} ${flat.flatNumber} ${flat.isActive ? "deactivated" : "activated"}.`);
      await load();
    } catch (err) {
      setError(err.message || "Unable to update flat");
    }
  };

  const towers = Array.from(new Set(allFlats.map((f) => f.tower).filter(Boolean)));

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Structure"
        title={terms.structure}
        description={`Build ${terms.unitPluralLower} manually, then activate or deactivate them.`}
        stats={[
          { label: terms.isCorporate ? "Groups" : "Towers", value: towers.length },
          { label: `Total ${terms.unitPlural}`, value: allFlats.length },
          { label: "Active",      value: allFlats.filter((f) => f.isActive !== false).length }
        ]}
      />
      {error  ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {status ? <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{status}</p> : null}

      {/* -- Create flat form -- */}
      <form onSubmit={singleCreate} className="panel rounded-xl p-6 max-w-xl">
        <div className="mb-5 flex items-center gap-3">
          <Home className="text-blue-700" size={22} />
          <div>
            <h3 className="text-base font-semibold text-slate-950">Add {terms.unit}</h3>
            <p className="text-xs text-slate-500">{terms.tower} and floor are optional.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label={`${terms.unit} Number`} value={singleForm.flatNumber} onChange={(v) => updateSingle("flatNumber", v)} required />
          <Input label={terms.tower} value={singleForm.tower} onChange={(v) => updateSingle("tower", v)} />
          <Input label="Floor" value={singleForm.floor} onChange={(v) => updateSingle("floor", v)} />
        </div>
        <button disabled={singleSaving} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
          <Plus size={16} /> {singleSaving ? "Creating..." : `Add ${terms.unit}`}
        </button>
      </form>

      {/* -- Tower overview cards -- */}
      {towers.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">{terms.isCorporate ? "Office Group Overview" : "Tower Overview"}</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {towers.map((tower) => {
              const tFlats = allFlats.filter((f) => f.tower === tower);
              const floors = Array.from(new Set(tFlats.map((f) => f.floor).filter(Boolean))).sort();
              const active = tFlats.filter((f) => f.isActive !== false).length;
              return (
                <div key={tower} className="panel rounded-xl p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Building2 className="text-blue-700" size={18} />
                    <h4 className="font-semibold text-slate-950">{tower}</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 p-2">
                      <p className="text-lg font-bold text-slate-900">{tFlats.length}</p>
                      <p className="text-[10px] font-semibold uppercase text-slate-400">{terms.unitPlural}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2">
                      <p className="text-lg font-bold text-slate-900">{floors.length}</p>
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Floors</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-2">
                      <p className="text-lg font-bold text-blue-700">{active}</p>
                      <p className="text-[10px] font-semibold uppercase text-blue-500">Active</p>
                    </div>
                  </div>
                  {floors.length > 0 && <p className="mt-2 text-[11px] text-slate-400">Floors: {floors.join(", ")}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -- All flats table -- */}
      <div className="panel rounded-xl p-0">
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-950">All {terms.unitPlural}  | {allFlats.length}</h3>
          <p className="text-xs text-slate-400">Activate or deactivate individual {terms.unitPluralLower} here</p>
        </div>
        <div className="overflow-x-auto">
          <table className="ops-table w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr>
                <th>{terms.unit}</th>
                <th>{terms.tower}</th>
                <th>Floor</th>
                <th>{terms.resident} IDs</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-slate-500">Loading...</td></tr>
              ) : allFlats.length === 0 ? (
                <tr><td colSpan="6" className="text-slate-500">No {terms.unitPluralLower} yet. Use the form above to create {terms.unitPluralLower}.</td></tr>
              ) : allFlats.map((flat) => {
                const owners   = [flat.owner, flat.owner2].filter(Boolean);
                const isActive = flat.isActive !== false;
                return (
                  <tr key={flat.id}>
                    <td className="font-medium text-slate-950">{flat.flatNumber}</td>
                    <td>{flat.tower || "-"}</td>
                    <td>{flat.floor || "-"}</td>
                    <td>
                      <span className={`inline-flex rounded-xl px-2 py-0.5 text-xs font-bold ${owners.length >= 2 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                        {owners.length}/2 IDs
                      </span>
                      {owners.length > 0 && <p className="mt-0.5 text-xs text-slate-400">{owners.map((o) => o.name).join(", ")}</p>}
                    </td>
                    <td><StatusPill status={isActive ? "ACTIVE" : "INACTIVE"} /></td>
                    <td>
                      <button
                        onClick={() => toggleActive(flat)}
                        className={`rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-blue-200 text-blue-600 hover:bg-blue-50"}`}
                      >
                        {isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function GuardManagement({ session }) {
  const { users, branches, error, loading, load } = useSocietyDirectory(session);
  const [form, setForm] = useState({
    role: "SECURITY_GUARD",
    name: "",
    email: "",
    phone: "",
    password: "",
    badgeNumber: "",
    shiftLabel: ""
  });
  const [gateAssignments, setGateAssignments] = useState({});
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const guards = users.filter((user) => user.role === "SECURITY_GUARD");

  useEffect(() => {
    setGateAssignments(Object.fromEntries(guards.map((guard) => [guard.id, guard.branch?.id || branches[0]?.id || ""])));
  }, [branches, users]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      await societyApi.createUser(session.accessToken, form);
      setStatus("Guard login created.");
      setForm((current) => ({ ...current, name: "", email: "", phone: "", badgeNumber: "", shiftLabel: "" }));
      await load();
    } catch (err) {
      setStatus(err.message || "Unable to create guard");
    } finally {
      setSaving(false);
    }
  };

  const assignGuardGate = async (userId) => {
    const branchId = gateAssignments[userId];
    if (!branchId) return;
    await societyApi.assignGuardGate(session.accessToken, userId, { branchId });
    setStatus("Guard gate assigned.");
    await load();
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader eyebrow="Guards" title="Guard management" description="Create security guard logins and assign gate duty." stats={[
        { label: "Guards", value: guards.length },
        { label: "Gates", value: branches.length },
        { label: "Duty", value: "Live" }
      ]} />
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <section className="grid gap-4 xl:grid-cols-[1fr_.9fr]">
        <form onSubmit={submit} className="panel rounded-xl p-6">
          <div className="mb-5 flex items-center gap-3">
            <ShieldCheck className="text-blue-700" size={24} />
            <h3 className="text-lg font-semibold text-slate-950">Create Guard</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Full Name" value={form.name} onChange={(value) => update("name", value)} required />
            <Input label="Email" value={form.email} onChange={(value) => update("email", value)} type="email" required />
            <Input label="Phone" value={form.phone} onChange={(value) => update("phone", value)} />
            <Input label="Password" value={form.password} onChange={(value) => update("password", value)} type="password" required />
            <Input label="Badge Number" value={form.badgeNumber} onChange={(value) => update("badgeNumber", value)} required />
            <Input label="Shift Label" value={form.shiftLabel} onChange={(value) => update("shiftLabel", value)} />
          </div>
          {status ? <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{status}</p> : null}
          <button disabled={saving} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
            <Plus size={17} />
            {saving ? "Creating..." : "Create Guard"}
          </button>
        </form>
        <div className="panel rounded-xl p-0">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-semibold text-slate-950">Guard Duty</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? <p className="p-5 text-sm text-slate-500">Loading guards...</p> : guards.length === 0 ? <p className="p-5 text-sm text-slate-500">No guards created yet.</p> : guards.map((guard) => (
              <div key={guard.id} className="p-4">
                <p className="font-medium text-slate-950">{guard.name}</p>
                <p className="mt-1 text-sm text-slate-500">{guard.guard?.badgeNumber || "No badge"} - {guard.email}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <select value={gateAssignments[guard.id] || ""} onChange={(event) => setGateAssignments((current) => ({ ...current, [guard.id]: event.target.value }))} className="field-glass h-10 rounded-xl px-3 text-sm outline-none">
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                  <button type="button" onClick={() => assignGuardGate(guard.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white">
                    <Save size={16} />
                    Assign
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function Input({ label, value, onChange, type = "text", required = false }) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {isPassword ? (
        <span className="field-glass mt-2 flex h-11 items-center rounded-xl px-3">
          <input value={value} onChange={(event) => onChange(event.target.value)} type={showPw ? "text" : "password"} required={required} className="w-full bg-transparent text-sm outline-none" />
          <button type="button" onClick={() => setShowPw((v) => !v)} className="ml-2 shrink-0 text-slate-400 hover:text-slate-700 transition">
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </span>
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} type={type} required={required} className="field-glass mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none focus:border-blue-500" />
      )}
    </label>
  );
}

function Select({ label, value, onChange, options, required = false }) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} required={required} className="field-glass mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none focus:border-blue-500">
        {options.length === 0 ? <option value="">Create gate first</option> : null}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function UserList({ title, users, loading, empty }) {
  return (
    <div className="panel rounded-xl p-0">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="font-semibold text-slate-950">{title}</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {loading ? <p className="p-5 text-sm text-slate-500">Loading...</p> : users.length === 0 ? <p className="p-5 text-sm text-slate-500">{empty}</p> : users.map((user) => (
          <div key={user.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-950">{user.name}</p>
                <p className="mt-1 text-sm text-slate-500">{user.email}</p>
              </div>
              <StatusPill status={user.status || user.role} />
            </div>
            {user.flats?.length ? <p className="mt-2 text-sm text-slate-600">{user.flats.map((flat) => flat.flatNumber).join(", ")}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function VisitorSearch({ session }) {
  const [query, setQuery] = useState("");
  const [visitors, setVisitors] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const data = await societyApi.visitors(session.accessToken);
        setVisitors(data.visitors || []);
      } catch (err) {
        setError(err.message || "Unable to load visitor records");
      }
    };
    load();
  }, [session.accessToken]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return visitors;
    return visitors.filter((visitor) => [
      visitor.fullName,
      visitor.phone,
      visitor.purpose,
      visitor.branch?.name,
      visitor.vehicles?.[0]?.number,
      visitor.gatepasses?.[0]?.passCode
    ].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [query, visitors]);

  return (
    <section className="grid gap-6">
      <WorkflowHeader eyebrow="Visitor Records" title="Search visitor records" description="Search visitors by name, phone, pass, vehicle, purpose, or gate." stats={[
        { label: "Visitors", value: visitors.length },
        { label: "Matches", value: filtered.length },
        { label: "Refresh", value: "Live" }
      ]} />
      <label className="field-glass flex h-12 max-w-2xl items-center gap-2 rounded-xl px-3">
        <Search size={18} className="text-slate-500" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search visitor records" className="w-full bg-transparent text-sm text-slate-900 outline-none" />
      </label>
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <VisitorTable visitors={filtered} />
    </section>
  );
}

function VisitorTable({ visitors }) {
  return (
    <div className="panel rounded-xl p-0">
      <div className="overflow-x-auto">
        <table className="ops-table w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr>
              <th>Image</th>
              <th>Visitor</th>
              <th>Phone</th>
              <th>Gate</th>
              <th>Vehicle</th>
              <th>Pass</th>
              <th>QR</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visitors.length === 0 ? (
              <tr><td colSpan="8" className="text-slate-500">No records found.</td></tr>
            ) : visitors.map((visitor) => {
              const pass = visitor.gatepasses?.[0];
              const visitorImage = getVisitorImage(visitor);
              const qrImage = getGatepassQrImage(pass);
              return (
                <tr key={visitor.id}>
                  <td>
                    {visitorImage ? (
                      <SafeThumb
                        src={visitorImage}
                        alt={visitor.fullName}
                        className="h-11 w-11 rounded-lg object-cover ring-1 ring-slate-200"
                        fallback={<div className="h-11 w-11 rounded-lg bg-slate-100 ring-1 ring-slate-200" />}
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-lg bg-slate-100 ring-1 ring-slate-200" />
                    )}
                  </td>
                  <td className="font-medium text-slate-950">{visitor.fullName}</td>
                  <td>{visitor.phone}</td>
                  <td>{visitor.branch?.name || pass?.branch?.name || "Assigned gate"}</td>
                  <td>{visitor.vehicles?.[0]?.number || "No vehicle"}</td>
                  <td>{pass?.passCode || "No pass"}</td>
                  <td>
                    {qrImage ? (
                      <SafeThumb
                        src={qrImage}
                        alt={`${pass?.passCode || "pass"} QR`}
                        className="h-11 w-11 rounded-md bg-white p-1 ring-1 ring-slate-200"
                        fallback={<div className="grid h-11 w-11 place-items-center rounded-md border border-slate-200 bg-slate-50 text-[9px] font-semibold text-slate-500">No QR</div>}
                      />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td><StatusPill status={pass?.status || "CREATED"} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -- Vehicle Monitoring - live/active vehicles currently inside -- */
function VehicleMonitoring({ session }) {
  const [visitors, setVisitors] = useState([]);
  const [error, setError]       = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = async () => {
    try {
      setError("");
      const data = await societyApi.visitors(session.accessToken);
      setVisitors(data.visitors || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || "Unable to load live vehicle data");
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [session.accessToken]);

  /* Only show vehicles tied to active/checked-in passes */
  const liveVehicles = visitors
    .filter((v) => ["ACTIVE", "CHECKED_IN"].includes(v.gatepasses?.[0]?.status) && v.vehicles?.length > 0)
    .flatMap((v) => v.vehicles.map((vh) => ({ ...vh, visitor: v, pass: v.gatepasses[0] })));

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Live  | Auto-refreshes every 10 s"
        title="Vehicle Monitoring"
        description="Vehicles currently inside the society - active or checked-in passes only."
        stats={[
          { label: "Vehicles inside", value: liveVehicles.length, tone: "teal" },
          { label: "Last refresh",    value: lastRefresh.toLocaleTimeString() },
          { label: "Status filter",   value: "Active / Checked-in" }
        ]}
      />
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {liveVehicles.length === 0 ? (
        <div className="panel rounded-xl p-10 text-center">
          <p className="text-2xl">Vehicle</p>
          <p className="mt-3 font-semibold text-slate-700">No vehicles currently inside</p>
          <p className="mt-1 text-sm text-slate-400">This view updates every 10 seconds. Only vehicles on active passes are shown.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {liveVehicles.map((vh) => (
            <div key={vh.id} className="panel rounded-xl border-l-4 border-l-blue-500 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-black tracking-wide text-slate-950">{vh.number}</p>
                  <p className="text-sm text-slate-500">{vh.type || "Unknown type"}</p>
                </div>
                <StatusPill status={vh.pass?.status} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                {getVisitorImage(vh.visitor) ? (
                  <SafeThumb
                    src={getVisitorImage(vh.visitor)}
                    alt={vh.visitor.fullName}
                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200"
                    fallback={<div className="h-10 w-10 rounded-lg bg-slate-100 ring-1 ring-slate-200" />}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-slate-100 ring-1 ring-slate-200" />
                )}
                {getGatepassQrImage(vh.pass) ? (
                  <SafeThumb
                    src={getGatepassQrImage(vh.pass)}
                    alt={`${vh.pass?.passCode || "pass"} QR`}
                    className="h-10 w-10 rounded-md bg-white p-1 ring-1 ring-slate-200"
                    fallback={<div className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-slate-50 text-[8px] font-semibold text-slate-500">No QR</div>}
                  />
                ) : null}
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                <p><span className="font-semibold">Visitor:</span> {vh.visitor.fullName}</p>
                <p className="mt-0.5"><span className="font-semibold">Gate:</span> {vh.visitor.branch?.name || "-"}</p>
                <p className="mt-0.5"><span className="font-semibold">Pass:</span> {vh.pass?.passCode}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* -- Vehicle Database - full historical searchable log -- */
function VehicleDatabase({ session }) {
  const [visitors, setVisitors] = useState([]);
  const [query, setQuery]       = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [error, setError]       = useState("");

  useEffect(() => {
    societyApi.visitors(session.accessToken)
      .then((d) => setVisitors(d.visitors || []))
      .catch((err) => setError(err.message || "Unable to load vehicle database"));
  }, [session.accessToken]);

  const allVehicles = visitors.flatMap((v) =>
    (v.vehicles || []).map((vh) => ({ ...vh, visitor: v, pass: v.gatepasses?.[0] }))
  );

  const types = ["ALL", ...Array.from(new Set(allVehicles.map((v) => v.type).filter(Boolean)))];

  const filtered = allVehicles.filter((vh) => {
    const term = query.trim().toLowerCase();
    const matchType = typeFilter === "ALL" || vh.type === typeFilter;
    const matchSearch = !term || [vh.number, vh.visitor.fullName, vh.visitor.phone, vh.visitor.branch?.name]
      .some((v) => String(v || "").toLowerCase().includes(term));
    return matchType && matchSearch;
  });

  const exportCsv = () => downloadCsv("vehicle-database.csv", [
    ["Vehicle No.", "Type", "Visitor", "Phone", "Gate", "Pass Code", "Status", "Date"],
    ...filtered.map((vh) => [vh.number, vh.type, vh.visitor.fullName, vh.visitor.phone, vh.visitor.branch?.name, vh.pass?.passCode, vh.pass?.status, new Date(vh.createdAt).toLocaleDateString()])
  ]);

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Historical Database"
        title="Vehicle Database"
        description="Complete searchable log of every vehicle that has ever entered or been registered."
        stats={[
          { label: "Total vehicles", value: allVehicles.length },
          { label: "Filtered",       value: filtered.length },
          { label: "Types",          value: types.length - 1 }
        ]}
      />
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="field-glass flex h-11 flex-1 items-center gap-2 rounded-xl px-3 min-w-[200px]">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plate, visitor name, gate..." className="w-full bg-transparent text-sm text-slate-900 outline-none" />
        </label>
        <div className="flex gap-1.5">
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${typeFilter === t ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="panel rounded-xl p-0">
        <div className="overflow-x-auto">
          <table className="ops-table w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr>
                <th>Vehicle No.</th>
                <th>Type</th>
                <th>Visitor</th>
                <th>Phone</th>
                <th>Gate</th>
                <th>Pass</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="8" className="text-slate-500">No vehicle records match your search.</td></tr>
              ) : filtered.map((vh) => (
                <tr key={vh.id}>
                  <td className="font-bold text-slate-950 tracking-wide">{vh.number}</td>
                  <td>{vh.type || "-"}</td>
                  <td>{vh.visitor.fullName}</td>
                  <td>{vh.visitor.phone}</td>
                  <td>{vh.visitor.branch?.name || "-"}</td>
                  <td className="font-mono text-xs">{vh.pass?.passCode || "-"}</td>
                  <td><StatusPill status={vh.pass?.status || "CREATED"} /></td>
                  <td>{new Date(vh.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ExportReports({ session }) {
  const [period, setPeriod] = useState("daily");
  const [downloading, setDownloading] = useState(null); // "visitors" | "logs" | "full"
  const [error, setError] = useState("");

  const periodOptions = [
    { value: "daily",         label: "Today" },
    { value: "weekly",        label: "Last 7 Days" },
    { value: "monthly",       label: "This Month" },
    { value: "last_3_months", label: "Last 3 Months" }
  ];

  const getFromDate = (p) => {
    const now = new Date();
    if (p === "daily")         return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
    if (p === "weekly")        return new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    if (p === "monthly")       return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    if (p === "last_3_months") return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10);
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" });
  const fmtTime = (d) => new Date(d).toLocaleTimeString("en-IN", { timeStyle: "short" });

  const handleDownload = async (type) => {
    setDownloading(type);
    setError("");
    try {
      const now = new Date();
      const fromDate = getFromDate(period);
      const toDate = now.toISOString().slice(0, 10);
      const periodLabel = periodOptions.find((o) => o.value === period)?.label ?? period;
      const generatedAt = now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
      const reportName = { logs: "CheckInOut", visitors: "Visitors", staff: "StaffAttendance", full: "FullReport" }[type] || "Report";
      const filename = `Mehman-${reportName}-${periodLabel.replace(/\s+/g, "-")}-${toDate}.csv`;

      let rows = [];

      if (type === "visitors" || type === "full") {
        const data = await societyApi.visitors(session.accessToken, `?limit=2000&from=${fromDate}`);
        const list = data.visitors || [];
        if (type === "full") rows.push(["VISITOR PASSES"], []);
        rows.push(
          ["Visitor", "Phone", "Purpose", "Gate", "Vehicle", "Pass", "Status", "Date", "Time"],
          ...list.map((v) => {
            const pass = v.gatepasses?.[0];
            const vehicle = v.vehicles?.[0];
            return [v.fullName ?? "", v.phone ?? "", v.purpose ?? "", v.branch?.name ?? pass?.metadata?.gateName ?? "", vehicle?.number ?? "", pass?.passCode ?? "", pass?.status ?? "", fmtDate(v.createdAt), fmtTime(v.createdAt)];
          })
        );
        if (type === "full") rows.push([]);
      }

      if (type === "logs" || type === "full") {
        const logData = await societyApi.entryLogs(session.accessToken, `?from=${fromDate}&to=${toDate}&limit=5000`);

        // Visitor check-in/out logs
        const logs = logData.logs || [];
        if (type === "full") rows.push(["VISITOR CHECK-IN / CHECK-OUT LOG"], []);
        rows.push(
          ["Visitor", "Phone", "Pass", "Action", "Gate", "Vehicle", "Logged By", "Role", "Date", "Time"],
          ...logs.map((log) => {
            const v = log.gatepass?.visitor;
            const vehicle = log.gatepass?.vehicle;
            return [v?.fullName ?? log.snapshot?.visitorName ?? "", v?.phone ?? "", log.gatepass?.passCode ?? log.snapshot?.passCode ?? "", log.action === "ENTRY" ? "Check-In" : log.action === "EXIT" ? "Check-Out" : log.action, log.branch?.name ?? "", vehicle?.number ?? "", log.loggedBy?.name ?? "", log.loggedBy?.role?.name ?? "", fmtDate(log.occurredAt), fmtTime(log.occurredAt)];
          })
        );

      }

      if (type === "staff" || type === "logs" || type === "full") {
        const staffData = await societyApi.operations(session.accessToken, "?limit=5000&category=Resident%20Staff");
        const allOps = staffData.operations || staffData.records || [];
        const staffAttendanceRows = getStaffAttendanceRows(allOps, fromDate, toDate, fmtDate, fmtTime);

        if (rows.length) rows.push([]);
        rows.push(
          ["HOUSEHOLD STAFF ATTENDANCE (Maid / Driver / Domestic)"],
          [],
          ["Staff Name", "Designation", "ID Number", "Flat", "Action", "Date", "Time", "Actioned By", "Current State", "Card No", "Date Added"],
          ...staffAttendanceRows
        );
      }

      downloadCsv(filename, rows);
    } catch (err) {
      setError(err.message || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader eyebrow="Reports" title="Export reports" description="Download visitor passes and check-in/check-out logs as CSV." stats={[
        { label: "Format", value: "CSV" },
        { label: "Status", value: "Ready" }
      ]} />
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="panel rounded-xl p-6 grid gap-6">
        {/* Period selector */}
        <div>
          <p className="mb-3 text-sm font-semibold text-slate-700">Select Period</p>
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  period === opt.value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Download buttons */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-900">Visitor Report</p>
            <p className="mt-1 text-xs text-slate-500">Visitor name, phone, purpose, gate, vehicle, pass code, status, date &amp; time</p>
            <button
              onClick={() => handleDownload("visitors")}
              disabled={!!downloading}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              <Download size={15} />
              {downloading === "visitors" ? "Preparing…" : "Download"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-900">Check-In / Check-Out Log</p>
            <p className="mt-1 text-xs text-slate-500">Visitor and staff movement, gate, guard, date &amp; time</p>
            <button
              onClick={() => handleDownload("logs")}
              disabled={!!downloading}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <Download size={15} />
              {downloading === "logs" ? "Preparing…" : "Download"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-900">Staff Attendance</p>
            <p className="mt-1 text-xs text-slate-500">Maid, driver, and domestic staff check-in/check-out history</p>
            <button
              onClick={() => handleDownload("staff")}
              disabled={!!downloading}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
            >
              <Download size={15} />
              {downloading === "staff" ? "Preparing..." : "Download"}
            </button>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="font-semibold text-slate-900">Full Report</p>
            <p className="mt-1 text-xs text-slate-500">Visitor passes, gate logs, and staff attendance in one file</p>
            <button
              onClick={() => handleDownload("full")}
              disabled={!!downloading}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              <Download size={15} />
              {downloading === "full" ? "Preparing…" : "Download All"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SocietySettings({ session }) {
  const terms = getClientTerms(session);
  const roleLabel = getRoleLabel(session.user.role, session);

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Settings"
        title={`${terms.client} settings`}
        description={`Current ${terms.clientLower} context used by admin, guard, and ${terms.residentLower} logins.`}
      />
      <div className="panel rounded-xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <Settings className="text-blue-700" size={24} />
          <h3 className="text-lg font-semibold text-slate-950">{session.user.company?.name || terms.client}</h3>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-slate-500">{terms.client} ID</dt><dd className="mt-1 font-medium text-slate-950">{session.user.companyId || "Not set"}</dd></div>
          <div><dt className="text-sm text-slate-500">Login Role</dt><dd className="mt-1 font-medium text-slate-950">{roleLabel}</dd></div>
          <div><dt className="text-sm text-slate-500">Admin</dt><dd className="mt-1 font-medium text-slate-950">{session.user.name}</dd></div>
          <div><dt className="text-sm text-slate-500">Email</dt><dd className="mt-1 font-medium text-slate-950">{session.user.email}</dd></div>
        </dl>
      </div>
    </section>
  );
}

function SecurityLogs({ session }) {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        setAnalytics(await societyApi.analytics(session.accessToken));
      } catch (err) {
        setError(err.message || "Unable to load security logs");
      }
    };
    load();
  }, [session.accessToken]);

  const logs = analytics?.recentLogs || [];

  return (
    <section className="grid gap-6">
      <WorkflowHeader eyebrow="Security" title="Security log monitoring" description="Recent entry and exit scans recorded by guards." stats={[
        { label: "Logs", value: logs.length },
        { label: "Entries", value: analytics?.cards?.entryLogs ?? 0 },
        { label: "Exits", value: analytics?.cards?.exitLogs ?? 0 }
      ]} />
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="panel rounded-xl p-0">
        <div className="divide-y divide-slate-100">
          {logs.length === 0 ? <p className="p-5 text-sm text-slate-500">No security logs yet.</p> : logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-4">
              <ShieldCheck size={18} className="mt-1 text-blue-700" />
              <div>
                <p className="font-medium text-slate-950">{log.action} - {log.gatepass?.visitor?.fullName || "Visitor"}</p>
                <p className="mt-1 text-sm text-slate-500">{log.branch?.name || "Gate"} by {log.loggedBy?.name || "Guard"} at {new Date(log.occurredAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PeopleManagement({ session }) {
  const terms = getClientTerms(session);
  const [tab, setTab] = useState("residents");
  const tabs = [
    { id: "residents", label: terms.residentPlural, desc: `Create and manage ${terms.residentLower} logins` },
    { id: "flats-towers", label: terms.structure, desc: `Create and manage ${terms.unitPluralLower}` },
    { id: "roles", label: "All Users", desc: "View all accounts by role" }
  ];

  return (
    <section className="grid gap-0">
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {tabs.map(({ id, label, desc }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            title={desc}
            className={`flex-1 min-w-[100px] rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition ${
              tab === id
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "residents"    && <ResidentManagement session={session} />}
      {tab === "flats-towers" && <FlatsAndTowers     session={session} />}
      {tab === "roles"        && <SocietyUsers        session={session} />}
    </section>
  );
}

function HouseholdRecordsPage({ session }) {
  const terms = getClientTerms(session);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setError("");
      const data = await societyApi.operations(session.accessToken, "?limit=200");
      const all = data.records || data.operations || [];
      setRecords(all.filter((record) => /resident suite|household|resident staff/i.test(record.category || "")));
    } catch (err) {
      setError(err.message || `Unable to load ${terms.householdRecords.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session.accessToken]);

  const byFeature = useMemo(() => records.reduce((acc, record) => {
    const feature = record.payload?.feature || record.title || "Household Record";
    acc[feature] = (acc[feature] || 0) + 1;
    return acc;
  }, {}), [records]);

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="People Management"
        title={terms.householdRecords}
        description={terms.isCorporate ? "Office staff records, office vehicles, and support ID cards are tracked here in real time." : "Family members, resident vehicles, and maid/driver ID cards submitted from resident app are tracked here in real time."}
        stats={[
          { label: "Records", value: records.length },
          { label: terms.isCorporate ? "Office Staff" : "Family Members", value: byFeature["Family members"] || 0 },
          { label: terms.isCorporate ? "Office Vehicles" : "Personal Vehicles", value: byFeature["Personal vehicles"] || 0 },
          { label: "Staff ID Cards", value: byFeature["Maid & Driver IDs"] || records.filter((record) => /resident staff/i.test(record.category || "")).length }
        ]}
      />
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="panel rounded-xl p-0">
        <div className="overflow-x-auto">
          <table className="ops-table w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr>
                <th>Record</th>
                <th>{terms.resident}</th>
                <th>{terms.unit}</th>
                <th>Details</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-slate-500">Loading {terms.householdRecords.toLowerCase()}...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan="6" className="text-slate-500">No {terms.householdRecords.toLowerCase()} submitted yet.</td></tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <p className="font-semibold text-slate-950">{record.payload?.feature || record.title}</p>
                      <p className="text-xs text-slate-500">{record.category}</p>
                    </td>
                    <td>
                      <p className="text-slate-900">{record.payload?.residentName || record.createdBy?.name || "-"}</p>
                      <p className="text-xs text-slate-500">{record.createdBy?.email || "-"}</p>
                    </td>
                    <td>
                      <p className="text-slate-800">
                        {terms.unit} {record.payload?.flatNumber || "-"}
                        {record.payload?.tower ? ` | ${record.payload.tower}` : ""}
                        {record.payload?.floor ? ` | Floor ${record.payload.floor}` : ""}
                      </p>
                    </td>
                    <td>
                      {record.payload?.photoUrl ? (
                        <img
                          src={record.payload.photoUrl}
                          alt={record.payload?.fullName || "Staff"}
                          className="mb-2 h-14 w-14 rounded-lg border border-slate-200 object-cover"
                        />
                      ) : null}
                      <p className="text-slate-700">
                        {record.payload?.name || record.payload?.fullName || record.payload?.vehicleNumber || record.payload?.note || record.description || "-"}
                      </p>
                      {record.payload?.staffRole ? <p className="text-xs text-slate-500">Role: {record.payload.staffRole}</p> : null}
                      {record.payload?.designation ? <p className="text-xs text-slate-500">Designation: {record.payload.designation}</p> : null}
                      {record.payload?.phone ? <p className="text-xs text-slate-500">Phone: {record.payload.phone}</p> : null}
                      {record.payload?.staffIdNumber ? <p className="text-xs text-slate-500">ID: {record.payload.staffIdNumber}</p> : null}
                      {record.payload?.cardNumber ? <p className="text-xs text-slate-500">Card No: {record.payload.cardNumber}</p> : null}
                      {record.payload?.note ? <p className="text-xs text-slate-500">{record.payload.note}</p> : null}
                    </td>
                    <td><StatusPill status={record.status} /></td>
                    <td className="text-xs text-slate-600">{new Date(record.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function AdminFeaturePage({ feature, session }) {
  const terms = getClientTerms(session);
  if (terms.isCorporate && CORPORATE_DISABLED_FEATURES.has(feature)) {
    return <DashboardOverview session={session} />;
  }
  /* Overview */
  if (feature === "Dashboard") return <DashboardOverview session={session} />;
  if (feature === "Inbox & Approvals") return <NotificationsInbox session={session} />;
  if (feature === "Operations Console") return <OperationsConsole session={session} />;
  /* People */
  if (feature === "People Management") return <PeopleManagement session={session} />;
  if (feature === "Guard Management")  return <GuardManagement  session={session} />;
  if (feature === "Household Records") return <HouseholdRecordsPage session={session} />;
  /* Legacy deep-links kept for backward compatibility */
  if (feature === "Resident Management")      return <PeopleManagement session={session} />;
  if (feature === "Flat Management")          return <PeopleManagement session={session} />;
  if (feature === "Tower / Block Management") return <PeopleManagement session={session} />;
  if (feature === "Guard Management")         return <PeopleManagement session={session} />;
  if (feature === "User Roles & Access")      return <PeopleManagement session={session} />;
  /* Security */
  if (feature === "Visitor Monitoring") return <VisitorsPage session={session} />;
  if (feature === "QR Pass Management") return <GatepassesPage session={session} />;
  if (feature === "Gate Management") return <GatesAndTowers session={session} />;
  if (feature === "Search Records") return <VisitorSearch session={session} />;
  if (feature === "Security Logs") return <SecurityLogs session={session} />;
  /* Vehicles */
  if (feature === "Vehicle Monitoring") return <VehicleMonitoring session={session} />;
  if (feature === "Vehicle Database")   return <VehicleDatabase   session={session} />;
  /* Services */
  if (feature === "Complaints & Feedback") return <ComplaintsPage session={session} />;
  if (feature === "Announcements") return <AnnouncementsPage session={session} />;
  if (feature === "Society Directory") return <DirectoryPage session={session} />;
  if (feature === "Amenities Booking") return <AmenitiesPage session={session} />;
  if (feature === "Maintenance Requests") return <MaintenancePage session={session} />;
  if (feature === "Voting System") return <VotingSystemPage session={session} />;
  if (feature === "Maintenance Billing") return <MaintenanceBillingPage session={session} />;
  /* Reports & Admin */
  if (feature === "Export Reports")  return <ExportReports  session={session} />;
  if (feature === "Society Settings") return <SocietySettings session={session} />;
  return <DashboardOverview session={session} />;
}
