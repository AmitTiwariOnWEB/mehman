import { CheckCircle2, Clock3, LogOut, ShieldAlert, UserRound } from "lucide-react";

const iconByStatus = {
  "Checked In": CheckCircle2,
  "Pre-approved": Clock3,
  Exited: LogOut,
  Awaiting: ShieldAlert
};

export function VisitorTable({ visitors }) {
  const rows = (visitors || []).map((visitor) => ({
    name: visitor.fullName,
    photoUrl: visitor.photoUrl,
    purpose: visitor.purpose,
    branch: visitor.gatepasses?.[0]?.branch?.name || visitor.branch?.name || "Assigned Gate",
    status: visitor.gatepasses?.[0]?.status || "Created",
    time: new Date(visitor.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }));

  return (
    <section className="panel rounded-lg p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Recent Visitors</h3>
          <p className="text-sm text-slate-500">Latest QR passes, approvals, and movements</p>
        </div>
        <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">New Visitor</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="py-3">Visitor</th>
              <th>Purpose</th>
              <th>Gate</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="py-8 text-center text-slate-500" colSpan={5}>
                  No visitors found in database yet.
                </td>
              </tr>
            ) : rows.map((visitor) => {
              const Icon = iconByStatus[visitor.status] || Clock3;
              return (
                <tr key={visitor.name} className="text-slate-600">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      {visitor.photoUrl ? (
                        <img src={visitor.photoUrl} alt={visitor.name} className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200" />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                          <UserRound size={17} />
                        </span>
                      )}
                      <span className="font-medium text-slate-950">{visitor.name}</span>
                    </div>
                  </td>
                  <td>{visitor.purpose}</td>
                  <td>{visitor.branch}</td>
                  <td>
                    <span className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs text-blue-800">
                      <Icon size={14} />
                      {visitor.status}
                    </span>
                  </td>
                  <td>{visitor.time}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

