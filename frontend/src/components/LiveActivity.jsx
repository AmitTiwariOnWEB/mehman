import { RadioTower } from "lucide-react";

export function LiveActivity({ items = [] }) {
  const feed = Array.isArray(items) ? items : [];

  return (
    <section className="panel rounded-lg p-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
          <RadioTower size={18} />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Live Gate Activity</h3>
          <p className="text-sm text-slate-500">Real-time operational stream</p>
        </div>
      </div>
      {feed.length === 0 ? (
        <p className="text-sm text-slate-500">No live activity yet.</p>
      ) : (
        <div className="space-y-4">
          {feed.map((activity, index) => (
            <div key={`${activity}-${index}`} className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
              <div>
                <p className="text-sm text-slate-800">{activity}</p>
                <p className="text-xs text-slate-500">{index + 1} min ago</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

