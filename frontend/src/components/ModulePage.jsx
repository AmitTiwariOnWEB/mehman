import { Activity, Building2, IdCard, QrCode, ShieldCheck, UsersRound } from "lucide-react";

const iconByView = {
  visitors: IdCard,
  gatepasses: QrCode,
  scanner: ShieldCheck,
  society: Building2,
  users: UsersRound,
  analytics: Activity,
  "business-reports": Activity
};

const copyByView = {
  visitors: ["Visitor Management", "Create, approve, blacklist, and track visitors with society and gate isolation."],
  gatepasses: ["QR Gatepass System", "Generate secure time-bound passes, monitor status, and manage duplicate-use controls."],
  scanner: ["Guard Scanner", "Scan QR codes, validate visitor access, and log entry or exit from the gate console."],
  society: ["Society Setup", "Manage society profile, towers, gates, reception desks, and operational settings."],
  users: ["User Management", "Society Admin creates guard IDs, flat owner IDs, and receptionist access from here."],
  analytics: ["Analytics", "Track visitor trends, active occupants, gate activity, and live operational metrics."],
  "business-reports": ["Business Reports", "Track society client growth, active accounts, app usage, renewals, and support workload."]
};

export function ModulePage({ view }) {
  const Icon = iconByView[view] || Activity;
  const [title, description] = copyByView[view] || copyByView.analytics;

  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <div className="panel rounded-lg p-6">
        <div className="grid h-14 w-14 place-items-center rounded-lg bg-blue-50 text-blue-700">
          <Icon size={28} />
        </div>
        <h3 className="mt-6 text-2xl font-semibold text-slate-950">{title}</h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {["Workflow", "Records", "Audit"].map((item) => (
            <button key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm text-slate-800 transition hover:border-blue-200 hover:bg-blue-50">
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="panel rounded-lg p-6">
        <h4 className="text-lg font-semibold text-slate-950">Module Status</h4>
        <div className="mt-5 space-y-4">
          {["API contract planned", "UI shell ready", "Production workflow next"].map((item) => (
            <div key={item} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-700">{item}</span>
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs text-blue-700">Ready</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

