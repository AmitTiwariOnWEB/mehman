import {
  Bell,
  CalendarCheck,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Home,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  QrCode,
  Send,
  Truck,
  Users,
  Wrench,
  X,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { societyApi } from "../lib/api";
import mehmanMark from "../assets/mehman-mark.webp";
import { getClientTerms } from "../lib/clientTerminology";
import { SubscriptionNotice } from "./SubscriptionNotice";
import { ChangePasswordModal } from "./ChangePasswordModal";

const showToast = (message, type = "success") => {
  if (typeof window !== "undefined" && message) {
    window.dispatchEvent(new CustomEvent("mehman:toast", { detail: { message, type } }));
  }
};

const TABS = [
  { id: "inbox",     label: "Inbox",          Icon: Home      },
  { id: "preapprove",label: "Pre-Approve",    Icon: QrCode    },
  { id: "history",   label: "History",        Icon: Clock     },
  { id: "household", label: "Household",      Icon: Users     },
  { id: "services",  label: "Services",       Icon: FileText  },
  { id: "alerts",    label: "Notifications",  Icon: Bell      }
];

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
  ) || getGatepassQrEndpoint(gatepass);
const hasQrPayload = (gatepass) => Boolean(gatepass?.passCode || gatepass?.qrPayload || gatepass?.qrCodePayload || gatepass?.metadata?.qrPayload || gatepass?.metadata?.qrCodePayload);
const getGatepassQrPayload = (gatepass) => {
  const payload = gatepass?.qrPayload || gatepass?.qrCodePayload || gatepass?.metadata?.qrPayload || gatepass?.metadata?.qrCodePayload;
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (payload && typeof payload === "object") return JSON.stringify(payload);
  return gatepass?.passCode || "";
};
const downloadGatepassPng = (gatepass, qrDataUrl) => {
  if (!gatepass || !qrDataUrl) return;
  const W = 720, H = 980;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const render = (qrImg) => {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 36);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#bfdbfe";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(56, 56, 608, 868, 28);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#1d4ed8";
    ctx.font = "bold 20px Arial";
    ctx.fillText("MEHMAN QR GATEPASS", W / 2, 124);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 34px Arial";
    ctx.fillText(gatepass.passCode || "", W / 2, 176);
    if (qrImg) ctx.drawImage(qrImg, 180, 222, 360, 360);
    ctx.textAlign = "left";
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 20px Arial";
    ctx.fillText("Visitor", 96, 650);
    ctx.fillStyle = "#334155";
    ctx.font = "24px Arial";
    ctx.fillText(gatepass.visitor?.fullName || "-", 96, 684);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 20px Arial";
    ctx.fillText("Valid Until", 96, 736);
    ctx.fillStyle = "#334155";
    ctx.font = "22px Arial";
    ctx.fillText(new Date(gatepass.validUntil).toLocaleString(), 96, 770);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${gatepass.passCode || "gatepass"}-qr-pass.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const drawWithSrc = (src) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => render(img);
    img.onerror = () => render(null);
    img.src = src;
  };

  if (qrDataUrl.startsWith("data:")) {
    drawWithSrc(qrDataUrl);
  } else {
    fetch(qrDataUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { render(img); URL.revokeObjectURL(objUrl); };
        img.onerror = () => { render(null); URL.revokeObjectURL(objUrl); };
        img.src = objUrl;
      })
      .catch(() => render(null));
  }
};

function GatepassQrCard({ gatepass }) {
  const [image, setImage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setImage("");

    if (hasQrPayload(gatepass)) {
      QRCode.toDataURL(getGatepassQrPayload(gatepass), {
        errorCorrectionLevel: "M",
        margin: 1,
        color: { dark: "#061827", light: "#ffffff" }
      }).then((dataUrl) => {
        if (active) setImage(dataUrl);
      }).catch(() => {
        if (active) {
          const fallback = getGatepassQrImage(gatepass);
          if (fallback) setImage(fallback);
          else setFailed(true);
        }
      });
    } else {
      const fallback = getGatepassQrImage(gatepass);
      if (fallback) setImage(fallback);
      else if (gatepass) setFailed(true);
    }
    return () => { active = false; };
  }, [gatepass]);

  const visibleImage = failed ? "" : image;
  return (
    <>
      {visibleImage ? (
        <img src={visibleImage} alt="Gatepass QR" className="mx-auto mt-4 h-44 w-44 rounded-xl bg-white p-2 ring-1 ring-blue-100" onError={() => setFailed(true)} />
      ) : failed ? (
        <div className="mx-auto mt-4 grid h-44 w-44 place-items-center rounded-xl border border-red-200 bg-red-50 px-3 text-center text-xs font-semibold text-red-600">QR unavailable. Use pass code {gatepass?.passCode || "-"}.</div>
      ) : (
        <div className="mx-auto mt-4 grid h-44 w-44 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">QR loading</div>
      )}
      <button type="button" onClick={() => downloadGatepassPng(gatepass, visibleImage)} disabled={!visibleImage} className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700 disabled:opacity-50">
        <Download size={15} /> Download QR Pass
      </button>
    </>
  );
}

const statusLabel = (status = "") =>
  String(status || "").toUpperCase() === "WORKING" || String(status || "").toUpperCase() === "IN_PROGRESS"
    ? "In progress"
    : String(status || "Created").replaceAll("_", " ");

export function ResidentWebPortal({ session, onLogout }) {
  const user = session.user;
  const token = session.accessToken;
  const terms = getClientTerms(session);
  const [tab, setTab] = useState("inbox");
  const [showChangePw, setShowChangePw] = useState(false);
  const tabs = TABS.map((item) => item.id === "household" ? { ...item, label: terms.isCorporate ? "Office Records" : item.label } : item);

  const initials = (user.name || "R")
    .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

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
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Mehman {terms.resident} Portal</p>
            <p className="text-sm font-bold text-slate-900 leading-tight">{user.name}</p>
          </div>
          {user.company?.name ? (
            <span className="hidden sm:inline-block rounded-xl border border-slate-200 bg-slate-50/90 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {user.company.name}
            </span>
          ) : null}
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
          {tabs.map(({ id, label, Icon }) => (
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
          {tab === "inbox"      && <ResidentInbox     token={token} />}
          {tab === "preapprove" && <PreApproveVisitor token={token} />}
          {tab === "history"    && <VisitorHistory    token={token} />}
          {tab === "household"  && <HouseholdRecords  token={token} session={session} />}
          {tab === "services"   && <ResidentServices  token={token} session={session} />}
          {tab === "alerts"     && <ResidentAlerts    token={token} />}
        </div>
      </main>
    </div>
  );
}

/* -- Household Records -- */
function HouseholdRecords({ token, session }) {
  const terms = getClientTerms(session);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [active, setActive] = useState(terms.isCorporate ? "Personal vehicles" : "Family members");
  const [form, setForm] = useState({ fullName: "", note: "", photoUrl: "" });

  const load = async () => {
    setLoading(true);
    try {
      setError("");
      const data = await societyApi.operations(token, "?limit=100");
      const all = data.records || data.operations || [];
      setRecords(all.filter((record) => /resident suite|household/i.test(record.category || "")));
    } catch (err) {
      setError(err.message || "Unable to load household records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const filtered = records.filter((record) => (record.payload?.feature || record.title) === active);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await societyApi.createOperation(token, {
        category: "Resident Suite",
        title: active,
        description: `${active} submitted from resident web portal.`,
        payload: {
          feature: active,
          name: form.fullName.trim(),
          note: form.note.trim(),
          ...(active === "Personal vehicles" && form.photoUrl ? { photoUrl: form.photoUrl } : {})
        }
      });
      setStatus(`${active} saved successfully.`);
      setForm({ fullName: "", note: "", photoUrl: "" });
      await load();
    } catch (err) {
      setError(err.message || "Unable to save household record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={terms.isCorporate ? "Office Records" : "Household"} title={terms.isCorporate ? "Office Records" : "Household Records"} desc={terms.isCorporate ? "Manage office vehicle records. These updates are visible to admin panel in real time." : "Manage family members and personal vehicle records. These updates are visible to admin panel in real time."} />

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
        {[
          ...(terms.isCorporate ? [] : [{ key: "Family members", label: "Family Members" }]),
          { key: "Personal vehicles", label: "Personal Vehicles" }
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActive(item.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${active === item.key ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-900">Add {active === "Family members" ? "Family Member" : "Vehicle Record"}</h3>
          <div className="mt-4 grid gap-4">
            <FormField
              label={active === "Family members" ? "Member Name" : "Vehicle Number"}
              value={form.fullName}
              onChange={(value) => setForm((current) => ({ ...current, fullName: value }))}
              required
            />
            <FormField
              label={active === "Family members" ? "Mobile / Relation Note" : "Vehicle Type / Owner Note"}
              value={form.note}
              onChange={(value) => setForm((current) => ({ ...current, note: value }))}
            />
            {active === "Personal vehicles" ? (
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Vehicle Image (optional)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return setForm((current) => ({ ...current, photoUrl: "" }));
                    const reader = new FileReader();
                    reader.onload = () => setForm((current) => ({ ...current, photoUrl: String(reader.result || "") }));
                    reader.readAsDataURL(file);
                  }}
                  className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-bold file:text-blue-700"
                />
              </label>
            ) : null}
          </div>
          {status && <SuccessBox msg={status} />}
          {error && <ErrorBox msg={error} />}
          <button
            disabled={saving || !form.fullName.trim()}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            <Plus size={16} />
            {saving ? "Saving..." : "Save Record"}
          </button>
        </form>

        <Section title={`${active}  | ${filtered.length}`}>
          {loading ? <Loader /> : filtered.length === 0 ? <Empty msg={`No ${active.toLowerCase()} yet.`} /> : filtered.map((record) => (
            <div key={record.id} className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <Users size={16} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{record.payload?.name || "-"}</p>
                <p className="mt-0.5 text-sm text-slate-500">{record.payload?.note || "No note"}</p>
                {record.payload?.photoUrl ? <img src={record.payload.photoUrl} alt={record.payload?.name || "Vehicle"} className="mt-2 h-16 w-20 rounded-lg border border-slate-200 object-cover" /> : null}
                <p className="mt-1 text-xs text-slate-400">{new Date(record.createdAt).toLocaleString()}</p>
              </div>
              <StatusBadge status={record.status} />
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

/* -- Inbox -- */
function ResidentInbox({ token }) {
  const [visitors, setVisitors]   = useState([]);
  const [operations, setOps]      = useState([]);
  const [loading, setLoading]     = useState(true);
  const [status, setStatus]       = useState("");
  const [error, setError]         = useState("");

  const load = async () => {
    try {
      setError("");
      const [vData, oData] = await Promise.all([
        societyApi.visitors(token),
        societyApi.operations(token, "?status=OPEN")
      ]);
      setVisitors(vData.visitors || []);
      setOps(oData.operations || []);
    } catch (err) {
      setError(err.message || "Unable to load inbox");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const pending = visitors.filter((v) => v.gatepasses?.some((gp) => ["DRAFT", "PENDING"].includes(gp.status)));

  const decide = async (passId, newStatus) => {
    setStatus("");
    setError("");
    try {
      await societyApi.updateGatepassStatus(token, passId, { status: newStatus });
      setStatus(newStatus === "ACTIVE" ? "Visitor approved." : "Visitor rejected.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to update");
    }
  };

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Inbox" title="Pending Approvals" desc="Visitors and deliveries waiting for your response." />
      {error && <ErrorBox msg={error} />}
      {status && <SuccessBox msg={status} />}

      <Section title={`Visitor Requests  | ${pending.length}`}>
        {loading ? <Loader /> : pending.length === 0 ? <Empty msg="No pending visitor requests." /> :
          pending.map((v) => {
            const pass = v.gatepasses?.find((gp) => ["DRAFT", "PENDING"].includes(gp.status));
            return (
              <div key={v.id} className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{v.fullName}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{v.phone}  | {v.purpose}</p>
                  {v.branch?.name && <p className="mt-0.5 text-xs text-slate-400">Gate: {v.branch.name}</p>}
                </div>
                <StatusBadge status={pass?.status} />
                <div className="flex gap-2">
                  <button onClick={() => decide(pass.id, "ACTIVE")} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 transition">
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button onClick={() => decide(pass.id, "CANCELLED")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            );
          })
        }
      </Section>

      <Section title={`Delivery & Operations  | ${operations.length}`}>
        {operations.length === 0 ? <Empty msg="No open delivery or service requests." /> :
          operations.map((op) => (
            <div key={op.id} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <Truck size={17} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{op.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{op.description}</p>
              </div>
              <StatusBadge status={op.status} />
            </div>
          ))
        }
      </Section>
    </div>
  );
}

/* -- Pre-Approve Visitor -- */
function PreApproveVisitor({ token }) {
  const [form, setForm] = useState({ fullName: "", phone: "", purpose: "", note: "", branchId: "", passType: "VISITOR" });
  const [branches, setBranches] = useState([]);
  const [createdPass, setCreatedPass] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    societyApi.branches(token)
      .then((data) => {
        const nextBranches = data.branches || [];
        setBranches(nextBranches);
        if (nextBranches.length > 0) {
          setForm((current) => ({ ...current, branchId: current.branchId || nextBranches[0].id }));
        }
      })
      .catch(() => {
        setBranches([]);
      });
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    setCreatedPass(null);
    try {
      const response = await societyApi.createVisitor(token, {
        branchId: form.branchId || undefined,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        purpose: form.purpose.trim() || (form.passType === "PARCEL" ? "Parcel pickup/drop" : form.passType === "DELIVERY" ? "Delivery" : "Visitor"),
        passType: form.passType
      });
      setCreatedPass(response.gatepass || null);
      setStatus("QR gatepass created. Share it with the visitor or delivery person.");
      setForm((current) => ({ fullName: "", phone: "", purpose: "", note: "", passType: current.passType, branchId: current.branchId || branches[0]?.id || "" }));
    } catch (err) {
      setError(err.message || "Unable to create visitor");
    } finally {
      setSaving(false);
    }
  };

  const phoneRequired = !["DELIVERY", "PARCEL"].includes(form.passType);
  const shareText = createdPass
    ? `Mehman ${createdPass.metadata?.passType || form.passType} Gatepass\nPass Code: ${createdPass.passCode}\nValid until: ${new Date(createdPass.validUntil).toLocaleString()}`
    : "";
  const copyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setStatus("Share text copied.");
    } catch {
      setStatus(shareText);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_.8fr]">
      <div>
        <PageHeader eyebrow="Pre-Approve" title="Add Expected Visitor" desc="Pre-approve a guest or delivery so they can enter without waiting." />
        <form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Entry Gate</span>
              <select
                value={form.branchId}
                onChange={(e) => update("branchId", e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                required
              >
                <option value="">Select gate</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Pass Type</span>
              <select
                value={form.passType}
                onChange={(e) => update("passType", e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="VISITOR">Visitor</option>
                <option value="DELIVERY">Delivery</option>
                <option value="PARCEL">Parcel</option>
              </select>
            </label>
            <FormField label="Visitor Full Name" value={form.fullName} onChange={(v) => update("fullName", v)} required />
            <FormField label={phoneRequired ? "Mobile Number" : "Mobile Number (optional)"} value={form.phone} onChange={(v) => update("phone", v)} required={phoneRequired} />
            <FormField label="Purpose / Reason"  value={form.purpose}  onChange={(v) => update("purpose", v)}  />
            <FormField label="Notes (optional)"  value={form.note}     onChange={(v) => update("note", v)}     />
          </div>
          {status && <SuccessBox msg={status} />}
          {error  && <ErrorBox msg={error} />}
          <button disabled={saving || !form.branchId || !form.fullName || (phoneRequired && !form.phone)} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50 hover:bg-blue-700 transition">
            <Send size={16} />
            {saving ? "Sending..." : "Create QR Gatepass"}
          </button>
        </form>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
        <div className="flex items-center gap-2 mb-3">
          <QrCode size={20} className="text-blue-700" />
          <p className="font-bold text-blue-900">How it works</p>
        </div>
        <ul className="space-y-2 text-sm text-blue-800">
          {["Enter visitor name & phone", "System creates a pending entry pass", "Guard scans & checks in your visitor", "You get notified on entry/exit"].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-200 text-[10px] font-black text-blue-800">{i + 1}</span>
              {step}
            </li>
          ))}
        </ul>
        {createdPass ? (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-white p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Gatepass Ready</p>
            <p className="mt-1 text-xl font-black text-slate-950">{createdPass.passCode}</p>
            {!["DELIVERY", "PARCEL"].includes(String(createdPass.metadata?.passType || "").toUpperCase()) && (
              <GatepassQrCard gatepass={createdPass} />
            )}
            <p className="mt-3 text-xs text-slate-500">Valid until {new Date(createdPass.validUntil).toLocaleString()}</p>
            <button type="button" onClick={copyShareText} className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">
              Copy Share Text
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -- Visitor History -- */
function VisitorHistory({ token }) {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    societyApi.visitors(token)
      .then((d) => setVisitors(d.visitors || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="History" title="Visitor History" desc="All visitor records linked to your account." />
      {error && <ErrorBox msg={error} />}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                {["Visitor", "Phone", "Purpose", "Gate", "Pass", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">Loading...</td></tr>
              ) : visitors.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">No visitor records yet.</td></tr>
              ) : visitors.map((v) => {
                const pass = v.gatepasses?.[0];
                return (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{v.fullName}</td>
                    <td className="px-5 py-3 text-slate-600">{v.phone}</td>
                    <td className="px-5 py-3 text-slate-600">{v.purpose}</td>
                    <td className="px-5 py-3 text-slate-600">{v.branch?.name || pass?.branch?.name || "-"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{pass?.passCode || "-"}</td>
                    <td className="px-5 py-3"><StatusBadge status={pass?.status || "CREATED"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -- Services -- */
function ResidentServices({ token, session }) {
  const terms = getClientTerms(session);
  const [serviceTab, setServiceTab] = useState("complaints");
  const [operations, setOps]        = useState([]);
  const [loading, setLoading]       = useState(true);
  const [form, setForm]             = useState({ title: "", description: "", category: "", date: "", slot: "" });
  const [saving, setSaving]         = useState(false);
  const [status, setStatus]         = useState("");
  const [error, setError]           = useState("");
  const [paidDates, setPaidDates]   = useState({});

  const categoryMap = {
    complaints:     "Complaint",
    maintenance:    "Maintenance",
    amenities:      "Amenity Booking",
    announcements:  "Announcement",
    billing:        "Maintenance Billing"
  };

  const load = async () => {
    try {
      const d = await societyApi.operations(token);
      setOps(d.records || d.operations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [serviceTab]);
  useEffect(() => {
    if (terms.isCorporate && serviceTab === "amenities") {
      setServiceTab("complaints");
    }
  }, [terms.isCorporate, serviceTab]);

  const submit = async (e) => {
    e.preventDefault();
    if (terms.isCorporate && serviceTab === "amenities") return;
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const payload = serviceTab === "amenities"
        ? { amenity: form.title.trim(), date: form.date, slot: form.slot }
        : undefined;

      await societyApi.createOperation(token, {
        title: form.title.trim(),
        description: form.description.trim(),
        category: categoryMap[serviceTab],
        ...(payload ? { payload } : {})
      });
      setStatus(`${categoryMap[serviceTab]} submitted successfully.`);
      setForm({ title: "", description: "", category: "", date: "", slot: "" });
      await load();
    } catch (err) {
      setError(err.message || "Unable to submit");
    } finally {
      setSaving(false);
    }
  };

  const serviceTabs = [
    { id: "complaints",    label: "Complaints",    Icon: MessageSquare },
    { id: "maintenance",   label: "Maintenance",   Icon: Wrench        },
    { id: "billing",       label: "Maintenance Bills", Icon: FileText   },
    ...(terms.isCorporate ? [] : [{ id: "amenities", label: "Amenities", Icon: CalendarCheck }]),
    { id: "announcements", label: "Announcements", Icon: Bell          }
  ];

  const filtered = operations.filter((op) => {
    const category = String(op.category || "").toLowerCase();
    if (serviceTab === "complaints") return category.includes("complaint");
    if (serviceTab === "amenities") return category.includes("amenity");
    if (serviceTab === "maintenance") return category.includes("maintenance") && !category.includes("maintenance billing");
    if (serviceTab === "billing") return category.includes("maintenance billing");
    if (serviceTab === "announcements") return category.includes("announcement");
    return category.includes(serviceTab);
  });

  const setOperationStatus = async (record, nextStatus) => {
    setStatus("");
    setError("");
    try {
      await societyApi.updateOperation(token, record.id, { status: nextStatus });
      setStatus(`${record.title} marked ${statusLabel(nextStatus).toLowerCase()}.`);
      await load();
    } catch (err) {
      setError(err.message || "Unable to update status");
    }
  };

  const submitBillPayment = async (record) => {
    const paidDate = String(paidDates[record.id] || "").trim();
    if (!paidDate) {
      setError("Select the paid date before submitting payment.");
      return;
    }
    setStatus("");
    setError("");
    try {
      await societyApi.updateOperation(token, record.id, {
        status: "PENDING_APPROVAL",
        payload: {
          ...(record.payload || {}),
          paidDate,
          paidAt: new Date(paidDate).toISOString()
        }
      });
      setStatus("Payment submitted for admin verification.");
      setPaidDates((current) => ({ ...current, [record.id]: "" }));
      await load();
    } catch (err) {
      setError(err.message || "Payment not submitted. Please check your connection and try again.");
    }
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Services"
        title={`${terms.client} Services`}
        desc={terms.isCorporate ? "Submit complaints and maintenance requests, and read announcements." : "Submit complaints, maintenance and amenity booking requests, and read announcements."}
      />

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
        {serviceTabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setServiceTab(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              serviceTab === id ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
        {serviceTab !== "announcements" && serviceTab !== "billing" ? (
          <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-bold text-slate-900">Submit {categoryMap[serviceTab]}</h3>
            <div className="grid gap-4">
              {serviceTab === "amenities" ? (
                <>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Amenity</span>
                    <select
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none"
                      required
                    >
                      <option value="">Select amenity</option>
                      {["Swimming Pool", "Gym / Fitness", "Clubhouse", "Tennis Court", "Badminton Court", "Community Hall"].map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Date (YYYY-MM-DD)" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} type="date" required />
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Time Slot</span>
                      <select
                        value={form.slot}
                        onChange={(e) => setForm((f) => ({ ...f, slot: e.target.value }))}
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none"
                        required
                      >
                        <option value="">Select slot</option>
                        {["06:00-08:00", "08:00-10:00", "10:00-12:00", "12:00-14:00", "14:00-16:00", "16:00-18:00", "18:00-20:00", "20:00-22:00"].map((slot) => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              ) : (
                <FormField label="Subject / Title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} required />
              )}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500"
                  placeholder="Describe the issue in detail..."
                />
              </label>
            </div>
            {status && <SuccessBox msg={status} />}
            {error  && <ErrorBox msg={error} />}
            <button disabled={saving || !form.title || !form.description} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50">
              <Send size={16} /> {saving ? "Submitting..." : `Submit ${categoryMap[serviceTab]}`}
            </button>
          </form>
        ) : null}

        <Section title={`${categoryMap[serviceTab]}s  | ${filtered.length}`}>
          {loading ? <Loader /> : filtered.length === 0 ? <Empty msg={`No ${categoryMap[serviceTab].toLowerCase()}s yet.`} /> :
            filtered.map((op) => {
              const isBilling = serviceTab === "billing";
              const billState = String(op.payload?.billState || "").toUpperCase();
              const isPaid = op.status === "RESOLVED" || billState === "PAID";
              const isPaymentReported = op.status === "PENDING_APPROVAL" || billState === "PAYMENT_REPORTED";
              return (
              <div key={op.id} className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{isBilling ? op.payload?.month || op.title : op.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {isBilling ? `Amount: INR ${Number(op.payload?.amount || 0).toLocaleString()}` : op.description}
                  </p>
                  {isBilling ? (
                    <>
                      <p className="mt-1 text-xs text-slate-400">Due: {op.payload?.dueDate || "-"}</p>
                      {op.payload?.reportedPaidAt ? <p className="mt-1 text-xs text-slate-500">Submitted: {new Date(op.payload.reportedPaidAt).toLocaleString()}</p> : null}
                      {op.payload?.paymentDeniedNote ? <p className="mt-1 text-xs font-semibold text-red-600">Rejected by admin: {op.payload.paymentDeniedNote}</p> : null}
                    </>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-400">{new Date(op.createdAt).toLocaleDateString()}</p>
                  {isBilling ? (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      {isPaid ? (
                        <span className="text-xs font-semibold text-blue-700">Paid and verified by admin.</span>
                      ) : isPaymentReported ? (
                        <span className="text-xs font-semibold text-amber-700">Payment submitted. Waiting for admin verification.</span>
                      ) : (
                        <>
                          <div className="w-44">
                            <FormField
                              label="Paid Date"
                              value={paidDates[op.id] || ""}
                              type="date"
                              onChange={(value) => setPaidDates((current) => ({ ...current, [op.id]: value }))}
                            />
                          </div>
                          <button type="button" onClick={() => submitBillPayment(op)} className="h-10 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white">
                            Submit Payment
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                  {["maintenance", "complaints"].includes(serviceTab) ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Status</span>
                      {["CLOSED", "RESOLVED"].includes(op.status) ? (
                        <span className="text-xs font-semibold text-slate-400">Final</span>
                      ) : serviceTab === "maintenance" ? (
                        <select
                          value={op.status === "WORKING" ? "IN_PROGRESS" : op.status}
                          onChange={(e) => setOperationStatus(op, e.target.value)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none"
                        >
                          <option value="OPEN">Open</option>
                          <option value="IN_PROGRESS">In progress</option>
                          <option value="CLOSED">Closed</option>
                        </select>
                      ) : op.status !== "CLOSED" ? (
                        <button type="button" onClick={() => setOperationStatus(op, "CLOSED")} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700">
                          Close complaint
                        </button>
                      ) : null}
                      <span className="text-xs text-slate-400">Created {new Date(op.createdAt).toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>
                <StatusBadge status={isBilling ? (isPaid ? "PAID" : isPaymentReported ? "PENDING_VERIFICATION" : "UNPAID") : op.status} />
              </div>
            );
            })
          }
        </Section>
      </div>
    </div>
  );
}

/* -- Notifications -- */
function ResidentAlerts({ token }) {
  const [notifications, setNotifs] = useState([]);
  const [loading, setLoading]      = useState(true);
  const [error, setError]          = useState("");

  const load = async () => {
    try {
      const d = await societyApi.notifications(token);
      setNotifs(d.notifications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await societyApi.markNotificationRead(token, id).catch(() => {});
    await load();
  };

  const markAllRead = async () => {
    await societyApi.markAllRead(token).catch(() => {});
    await load();
  };

  const unread = notifications.filter((n) => !n.readAt);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader eyebrow="Notifications" title="Alerts & Updates" desc={`${unread.length} unread notification${unread.length === 1 ? "" : "s"}.`} />
        {unread.length > 0 ? (
          <button type="button" onClick={markAllRead} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">
            Mark all read
          </button>
        ) : null}
      </div>
      {error && <ErrorBox msg={error} />}
      <Section title="All Notifications">
        {loading ? <Loader /> : notifications.length === 0 ? <Empty msg="No notifications yet." /> :
          notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 ${!n.readAt ? "bg-blue-50/50" : ""}`}>
              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${!n.readAt ? "bg-blue-500" : "bg-slate-200"}`} />
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>}
                <p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.readAt && (
                <button onClick={() => markRead(n.id)} className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                  Mark read
                </button>
              )}
            </div>
          ))
        }
      </Section>
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

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <p className="text-sm font-bold text-slate-900">{title}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500"
      />
    </label>
  );
}

function StatusBadge({ status }) {
  const map = {
    DRAFT:      "bg-amber-50 text-amber-700 border-amber-200",
    PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
    ACTIVE:     "bg-blue-50 text-blue-700 border-blue-200",
    CHECKED_IN: "bg-blue-50 text-blue-700 border-blue-200",
    CANCELLED:  "bg-red-50 text-red-700 border-red-200",
    EXPIRED:    "bg-slate-100 text-slate-500 border-slate-200",
    OPEN:       "bg-amber-50 text-amber-700 border-amber-200",
    WORKING:    "bg-amber-50 text-amber-700 border-amber-200",
    IN_PROGRESS:"bg-amber-50 text-amber-700 border-amber-200",
    PENDING_VERIFICATION:"bg-amber-50 text-amber-700 border-amber-200",
    CLOSED:     "bg-slate-100 text-slate-500 border-slate-200",
    CREATED:    "bg-slate-100 text-slate-600 border-slate-200",
    UNPAID:     "bg-red-50 text-red-700 border-red-200",
    PAID:       "bg-blue-50 text-blue-700 border-blue-200"
  };
  return (
    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${map[status] || "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {statusLabel(status)}
    </span>
  );
}

function SuccessBox({ msg }) {
  useEffect(() => { showToast(msg, "success"); }, [msg]);
  return <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"><CheckCircle size={15} className="mt-0.5 shrink-0" />{msg}</div>;
}

function ErrorBox({ msg }) {
  useEffect(() => { showToast(msg, "error"); }, [msg]);
  return <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><X size={15} className="mt-0.5 shrink-0" />{msg}</div>;
}

function Loader() { return <p className="px-5 py-6 text-sm text-slate-400">Loading...</p>; }
function Empty({ msg }) { return <p className="px-5 py-6 text-sm text-slate-400">{msg}</p>; }

