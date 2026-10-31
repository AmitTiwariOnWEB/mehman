import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function DashboardChart({ trend = [], trendLabel = "Last 7 days" }) {
  const hasData = trend.some((item) => item.visitors > 0 || item.entries > 0);

  return (
    <section className="panel rounded-2xl p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-950">Visitor Trend</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Entry and visitor volume across active gates
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2 w-4 rounded-full bg-blue-500" />
            Visitors
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2 w-4 rounded-full bg-blue-400" />
            Entries
          </div>
          <span className="rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
            {trendLabel}
          </span>
        </div>
      </div>

      <div className="h-72">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="visitorGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="entryGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="#94a3b8"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  color: "#0f172a",
                  fontSize: 13,
                  boxShadow: "0 4px 16px rgba(15,23,42,0.1)"
                }}
              />
              <Area
                type="monotone"
                dataKey="visitors"
                stroke="#1d4ed8"
                fill="url(#visitorGrad)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#1d4ed8", stroke: "#fff", strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="entries"
                stroke="#60a5fa"
                fill="url(#entryGrad)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#60a5fa", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-300 text-center">
            <div>
              <p className="font-semibold text-slate-700">No visitor trend yet</p>
              <p className="mt-1 text-sm text-slate-400">
                Create visitors and scan entries to populate this chart.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

