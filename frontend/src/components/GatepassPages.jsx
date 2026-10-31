import { Camera, Download, Plus, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { societyApi } from "../lib/api";
import { getClientTerms } from "../lib/clientTerminology";
import { StatusPill, WorkflowHeader, WorkflowLayout } from "./WorkflowPrimitives";

const emptyVisitorForm = {
  branchId: "",
  fullName: "",
  phone: "",
  organization: "",
  purpose: "",
  vehicleNumber: "",
  vehicleType: "",
  validUntil: ""
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "Not set");
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
const getGatepassQrPayload = (gatepass) => {
  const payload = gatepass?.qrPayload || gatepass?.qrCodePayload || gatepass?.metadata?.qrPayload || gatepass?.metadata?.qrCodePayload;
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (payload && typeof payload === "object") return JSON.stringify(payload);
  return gatepass?.passCode || "";
};
const hasQrPayload = (gatepass) => Boolean(gatepass?.passCode || gatepass?.qrPayload || gatepass?.qrCodePayload || gatepass?.metadata?.qrPayload || gatepass?.metadata?.qrCodePayload);

const escapeSvg = (value = "") =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function downloadGatepassSvg(gatepass, qrDataUrl) {
  if (!gatepass || !qrDataUrl) return;
  const visitor = gatepass.visitor || {};
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="980" viewBox="0 0 720 980">
  <rect width="720" height="980" rx="36" fill="#f8fafc"/>
  <rect x="56" y="56" width="608" height="868" rx="28" fill="#ffffff" stroke="#bfdbfe" stroke-width="2"/>
  <text x="360" y="124" text-anchor="middle" font-family="Arial" font-size="20" font-weight="700" fill="#1d4ed8">MEHMAN QR GATEPASS</text>
  <text x="360" y="176" text-anchor="middle" font-family="Arial" font-size="34" font-weight="800" fill="#0f172a">${escapeSvg(gatepass.passCode)}</text>
  <image href="${qrDataUrl}" x="180" y="222" width="360" height="360"/>
  <text x="96" y="650" font-family="Arial" font-size="20" font-weight="700" fill="#0f172a">Visitor</text>
  <text x="96" y="684" font-family="Arial" font-size="24" fill="#334155">${escapeSvg(visitor.fullName || visitor.name || "-")}</text>
  <text x="96" y="736" font-family="Arial" font-size="20" font-weight="700" fill="#0f172a">Purpose</text>
  <text x="96" y="770" font-family="Arial" font-size="22" fill="#334155">${escapeSvg(visitor.purpose || gatepass.metadata?.passType || "Visitor")}</text>
  <text x="96" y="822" font-family="Arial" font-size="20" font-weight="700" fill="#0f172a">Valid Until</text>
  <text x="96" y="856" font-family="Arial" font-size="22" fill="#334155">${escapeSvg(formatDateTime(gatepass.validUntil))}</text>
</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${gatepass.passCode || "gatepass"}-qr-pass.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

function GatepassQr({ gatepass, sizeClass = "h-20 w-20", showDownload = false }) {
  const initialImage = getGatepassQrImage(gatepass);
  const [image, setImage] = useState(initialImage);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const existing = getGatepassQrImage(gatepass);
    setImage(existing);
    setFailed(false);
    if (!existing && hasQrPayload(gatepass)) {
      QRCode.toDataURL(getGatepassQrPayload(gatepass), {
        errorCorrectionLevel: "M",
        margin: 1,
        color: { dark: "#061827", light: "#ffffff" }
      }).then((dataUrl) => {
        if (active) setImage(dataUrl);
      }).catch(() => {
        if (active) {
          setImage("");
          setFailed(true);
        }
      });
    } else if (!existing && gatepass) {
      setFailed(true);
    }
    return () => { active = false; };
  }, [gatepass]);

  const visibleImage = failed ? "" : image;
  return (
    <div className="flex flex-col items-center gap-2">
      {visibleImage ? (
        <img src={visibleImage} alt={`${gatepass?.passCode || "Gatepass"} QR`} className={`${sizeClass} rounded-xl bg-white p-1 ring-1 ring-slate-200`} onError={() => setFailed(true)} />
      ) : failed ? (
        <div className={`${sizeClass} grid place-items-center rounded-xl border border-red-200 bg-red-50 px-2 text-center text-[10px] font-semibold text-red-600`}>QR unavailable<br />{gatepass?.passCode || ""}</div>
      ) : (
        <div className={`${sizeClass} grid place-items-center rounded-xl border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500`}>QR loading</div>
      )}
      {showDownload ? (
        <button type="button" onClick={() => downloadGatepassSvg(gatepass, visibleImage)} disabled={!visibleImage} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">
          <Download size={12} /> Download Pass
        </button>
      ) : null}
    </div>
  );
}

function SafeImage({ src, alt, className, fallback }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback || null;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

function VisitorPhoto({ visitor, size = "h-12 w-12" }) {
  const source = normalizeImageSource(visitor?.photoUrl || visitor?.gatepasses?.[0]?.metadata?.visitorPhotoUrl || visitor?.gatepasses?.[0]?.metadata?.photoUrl);
  if (source) {
    return (
      <SafeImage
        src={source}
        alt={visitor.fullName}
        className={`${size} rounded-xl object-cover ring-1 ring-slate-200`}
        fallback={
          <div className={`${size} grid place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100`}>
            <UserRound size={20} />
          </div>
        }
      />
    );
  }

  return (
    <div className={`${size} grid place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100`}>
      <UserRound size={20} />
    </div>
  );
}

export function VisitorsPage({ session }) {
  const terms = getClientTerms(session);
  const showValidityControl = !terms.isCorporate;
  const [branches, setBranches] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [createdPass, setCreatedPass] = useState(null);
  const [form, setForm] = useState(emptyVisitorForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => {
    try {
      setError("");
      const [branchData, visitorData] = await Promise.all([
        societyApi.branches(session.accessToken),
        societyApi.visitors(session.accessToken)
      ]);
      const nextBranches = branchData.branches || [];
      setBranches(nextBranches);
      setVisitors(visitorData.visitors || []);
      setForm((current) => ({ ...current, branchId: current.branchId || nextBranches[0]?.id || "" }));
    } catch (err) {
      setError(err.message || "Unable to load visitor workflow");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session.accessToken]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const copyCreatedPass = async () => {
    if (!createdPass) return;
    const text = [
      "Mehman QR Gatepass",
      `Pass Code: ${createdPass.passCode}`,
      `Valid Until: ${formatDateTime(createdPass.validUntil)}`
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Gatepass share text copied.");
    } catch {
      setStatus(text);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    setCreatedPass(null);

    try {
      const body = {
        branchId: form.branchId,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        organization: form.organization.trim() || undefined,
        purpose: form.purpose.trim(),
        validUntil: showValidityControl && form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
        ...(form.vehicleNumber.trim()
          ? {
              vehicle: {
                number: form.vehicleNumber.trim(),
                type: form.vehicleType.trim() || undefined
              }
            }
          : {})
      };

      const response = await societyApi.createVisitor(session.accessToken, body);
      setCreatedPass(response.gatepass);
      setStatus("Visitor and QR gatepass created.");
      setForm((current) => ({ ...emptyVisitorForm, branchId: current.branchId }));
      await load();
    } catch (err) {
      setError(err.message || "Unable to create visitor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Visitor Workflow"
        title="Visitor Entry & Gatepass Desk"
        description={terms.isCorporate
            ? "Create visitor records, assign gate, capture vehicle details, and issue QR passes from a single controlled workflow."
          : "Create visitor records, assign gate, capture vehicle details, set validity, and issue QR passes from a single controlled workflow."}
        stats={[
          { label: "Visitors", value: visitors.length },
          { label: "Gates", value: branches.length },
          { label: "Latest Pass", value: createdPass ? "Ready" : "None" }
        ]}
      />
      <WorkflowLayout
        main={
      <form onSubmit={submit} className="panel rounded-xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Camera size={22} />
          </span>
          <div>
            <h3 className="text-xl font-semibold text-slate-950">Create Visitor Gatepass</h3>
            <p className="text-sm text-slate-500">Add visitor details, vehicle, gate, and QR validity.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="text-sm font-medium text-slate-700">Gate</span>
            <select value={form.branchId} onChange={(event) => update("branchId", event.target.value)} className="field-glass mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none focus:border-blue-500" required>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          {showValidityControl ? (
            <label>
              <span className="text-sm font-medium text-slate-700">Valid Until</span>
              <input value={form.validUntil} onChange={(event) => update("validUntil", event.target.value)} type="datetime-local" className="field-glass mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none focus:border-blue-500" />
            </label>
          ) : null}
          {[
            ["fullName", "Visitor Name", "text"],
            ["phone", "Mobile Number", "tel"],
            ["purpose", "Purpose", "text"],
            ["organization", "Company / Relation", "text"],
            ["vehicleNumber", "Vehicle Number", "text"],
            ["vehicleType", "Vehicle Type", "text"]
          ].map(([key, label, type]) => (
            <label key={key}>
              <span className="text-sm font-medium text-slate-700">{label}</span>
              <input value={form[key]} onChange={(event) => update(key, event.target.value)} type={type} className="field-glass mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none focus:border-blue-500" required={["fullName", "phone", "purpose"].includes(key)} />
            </label>
          ))}
        </div>

        {branches.length === 0 ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-800">Create Main Gate, Back Gate, Front Gate, or any required gate first from Gates & Towers.</p> : null}
        {status ? <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-sm text-blue-800">{status}</p> : null}
        {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <button disabled={saving || branches.length === 0} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
          <Plus size={18} />
          {saving ? "Creating..." : "Create QR Gatepass"}
        </button>
      </form>
        }
        queue={
      <div className="grid gap-6">
        {createdPass ? (
          <div className="panel rounded-xl p-6">
            <h4 className="text-lg font-semibold text-slate-950">Gatepass Ready</h4>
            <div className="mt-5 flex flex-col items-center rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-center">
              <p className="text-2xl font-semibold text-slate-950">{createdPass.passCode}</p>
              <GatepassQr gatepass={createdPass} sizeClass="mt-4 h-52 w-52" showDownload />
              <p className="mt-3 text-sm text-slate-600">Valid until {formatDateTime(createdPass.validUntil)}</p>
              <button type="button" onClick={copyCreatedPass} className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">
                Copy Share Text
              </button>
            </div>
          </div>
        ) : null}

        <div className="panel rounded-xl p-0">
          <div className="border-b border-slate-200 px-5 py-4">
          <h4 className="text-lg font-semibold text-slate-950">Recent Visitors</h4>
          <p className="mt-1 text-sm text-slate-500">Latest gatepass requests and visitor movement.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? <p className="text-sm text-slate-500">Loading visitors...</p> : visitors.length === 0 ? <p className="text-sm text-slate-500">No visitors created yet.</p> : visitors.slice(0, 8).map((visitor) => {
              const pass = visitor.gatepasses?.[0];
              return (
                <div key={visitor.id} className="flex gap-3 p-4">
                  <VisitorPhoto visitor={visitor} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-950">{visitor.fullName}</p>
                    <p className="mt-1 text-sm text-slate-500">{visitor.purpose} at {pass?.branch?.name || visitor.branch?.name || "selected gate"}</p>
                    <div className="mt-2"><StatusPill status={pass?.status || "Created"} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
        }
      />
    </section>
  );
}

export function GatepassesPage({ session }) {
  const [visitors, setVisitors] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const data = await societyApi.visitors(session.accessToken);
        setVisitors(data.visitors || []);
      } catch (err) {
        setError(err.message || "Unable to load gatepasses");
      }
    };
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [session.accessToken]);

  const passes = useMemo(
    () => visitors.flatMap((visitor) => (visitor.gatepasses || []).map((gatepass) => ({ ...gatepass, visitor }))),
    [visitors]
  );

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Access Control"
        title="Gatepass Register"
        description="QR code, visitor image, vehicle, gate, validity, and movement status in one audit-friendly view."
        stats={[
          { label: "Passes", value: passes.length },
          { label: "Visitors", value: visitors.length },
          { label: "Refresh", value: "10s" }
        ]}
      />
      <div className="-mt-6">
        {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </div>

      {passes.length === 0 ? (
        <div className="panel rounded-xl p-8 text-center text-sm text-slate-500">No gatepasses yet. Create a visitor gatepass from the Visitors page.</div>
      ) : (
        <div className="panel rounded-xl p-0">
          <div className="overflow-x-auto">
            <table className="ops-table w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr>
                  <th>Visitor</th>
                  <th>Pass</th>
                  <th>Created By</th>
                  <th>Gate</th>
                  <th>Vehicle</th>
                  <th>Valid Until</th>
                  <th>QR</th>
                </tr>
              </thead>
              <tbody>
          {passes.map((pass) => (
            <tr key={pass.id}>
              <td>
                <div className="flex gap-3">
                <VisitorPhoto visitor={pass.visitor} size="h-16 w-16" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-slate-950">{pass.visitor.fullName}</h4>
                    <StatusPill status={pass.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{pass.visitor.purpose}</p>
                  {pass.metadata?.flatNumber ? <p className="mt-1 text-xs font-semibold text-slate-500">Flat/Office: {pass.metadata.flatNumber}</p> : null}
                </div>
              </div>
              </td>
              <td className="font-medium text-slate-700">{pass.passCode}</td>
              <td>
                <p className="font-medium text-slate-700">{pass.visitor.createdBy?.name || "System"}</p>
                <p className="mt-0.5 text-xs text-slate-400">{pass.metadata?.sourceRole || pass.visitor.createdBy?.role?.name || "-"}</p>
              </td>
              <td>{pass.branch?.name || pass.visitor.branch?.name || "Assigned gate"}</td>
              <td>{pass.vehicle?.number || pass.visitor.vehicles?.[0]?.number || "No vehicle"}</td>
              <td>{formatDateTime(pass.validUntil)}</td>
              <td>
                <GatepassQr gatepass={pass} showDownload />
              </td>
            </tr>
          ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

