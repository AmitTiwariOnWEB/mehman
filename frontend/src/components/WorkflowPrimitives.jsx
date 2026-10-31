import { AlertTriangle, Clock3, Download, PlayCircle } from "lucide-react";

const STATUS_STYLES = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  CHECKED_IN: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  CHECKED_OUT: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  DRAFT: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  CREATED: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  OPEN: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  WORKING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  PENDING_VERIFICATION: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  UNPAID: "bg-red-50 text-red-700 ring-1 ring-red-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 ring-1 ring-red-200",
  EXPIRED: "bg-red-50 text-red-700 ring-1 ring-red-200",
  REJECTED: "bg-red-50 text-red-700 ring-1 ring-red-200",
  INACTIVE: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
  FLAT_OWNER: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  SECURITY_GUARD: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  RECEPTIONIST: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  SOCIETY_ADMIN: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  SUPER_ADMIN: "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
};

const DOT_STYLES = {
  ACTIVE: "bg-emerald-500",
  CHECKED_IN: "bg-blue-500",
  CHECKED_OUT: "bg-blue-500",
  APPROVED: "bg-emerald-500",
  DRAFT: "bg-slate-400",
  CREATED: "bg-slate-400",
  PENDING: "bg-amber-500",
  OPEN: "bg-amber-500",
  WORKING: "bg-amber-500",
  IN_PROGRESS: "bg-amber-500",
  PENDING_VERIFICATION: "bg-amber-500",
  UNPAID: "bg-red-500",
  PAID: "bg-emerald-500",
  CANCELLED: "bg-red-500",
  EXPIRED: "bg-red-500",
  REJECTED: "bg-red-500",
  INACTIVE: "bg-slate-400",
  FLAT_OWNER: "bg-blue-500",
  SECURITY_GUARD: "bg-blue-500",
  RECEPTIONIST: "bg-purple-500",
  SOCIETY_ADMIN: "bg-indigo-500",
  SUPER_ADMIN: "bg-rose-500"
};

const STATUS_LABELS = {
  WORKING: "In progress",
  IN_PROGRESS: "In progress",
  PENDING_VERIFICATION: "Pending verification",
  PAID: "Paid",
  UNPAID: "Unpaid"
};

export function StatusPill({ status, priority }) {
  if (priority === "CRITICAL" || priority === "HIGH") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-200">
        <AlertTriangle size={11} />
        {priority}
      </span>
    );
  }

  const key = (status || "").toUpperCase().replace(/\s+/g, "_");
  const pillClass = STATUS_STYLES[key] || "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  const dotClass = DOT_STYLES[key] || "bg-slate-400";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${pillClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {STATUS_LABELS[key] || status || "Unknown"}
    </span>
  );
}

export function WorkflowHeader({ eyebrow, title, description, stats = [], actions = null }) {
  return (
    <section className="panel rounded-2xl p-6 sm:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">{title}</h3>
          {description ? (
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{description}</p>
          ) : null}
        </div>
        {stats.length ? (
          <div className="grid min-w-72 grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/70 text-center">
            {stats.map((stat, index) => (
              <div key={stat.label} className={`p-3 ${index > 0 ? "border-l border-slate-200" : ""}`}>
                <p className="tabular-nums text-2xl font-bold text-slate-950">{stat.value}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        ) : (
          actions
        )}
      </div>
    </section>
  );
}

export function WorkflowLayout({ main, queue }) {
  return <section className="grid gap-4 xl:grid-cols-[1.5fr_.5fr]">{main}{queue}</section>;
}

export function WorkflowQueue({ title = "Workflow Queue", records = [], onAdvance, onClose, onExport }) {
  return (
    <aside className="panel rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-950">{title}</h4>
        <div className="flex items-center gap-2">
          {onExport ? (
            <button
              onClick={onExport}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
              aria-label="Export queue"
            >
              <Download size={14} />
            </button>
          ) : null}
          <Clock3 size={16} className="text-slate-400" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {records.length === 0 ? (
          <p className="text-sm text-slate-500">No active workflows yet.</p>
        ) : (
          records.map((record) => (
            <div key={record.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{record.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{record.category}</p>
                </div>
                <StatusPill priority={record.priority} status={record.status} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {record.createdBy?.name || "User"} - {new Date(record.createdAt).toLocaleString()}
              </p>
              {onAdvance || onClose ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {onAdvance ? (
                    <button
                      onClick={() => onAdvance(record)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
                    >
                      <PlayCircle size={12} />
                      Progress
                    </button>
                  ) : null}
                  {onClose ? (
                    <button
                      onClick={() => onClose(record)}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Close
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export function exportRecordsCsv(filename, records) {
  const rows = [
    ["Title", "Category", "Status", "Priority", "Created By", "Created At"],
    ...records.map((record) => [
      record.title,
      record.category,
      record.status,
      record.priority,
      record.createdBy?.name || "",
      new Date(record.createdAt).toLocaleString()
    ])
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
