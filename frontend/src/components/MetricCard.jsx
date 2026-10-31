import { Activity, LogIn, LogOut, Users } from "lucide-react";

const toneMap = {
  teal: {
    wrapBg: "bg-blue-50",
    iconText: "text-blue-700",
    deltaText: "text-blue-700",
    Icon: Users
  },
  blue: {
    wrapBg: "bg-blue-50",
    iconText: "text-blue-700",
    deltaText: "text-blue-700",
    Icon: Activity
  },
  emerald: {
    wrapBg: "bg-emerald-50",
    iconText: "text-emerald-700",
    deltaText: "text-emerald-700",
    Icon: LogIn
  },
  amber: {
    wrapBg: "bg-amber-50",
    iconText: "text-amber-700",
    deltaText: "text-amber-700",
    Icon: LogOut
  }
};

export function MetricCard({ metric }) {
  const tone = toneMap[metric.tone] || toneMap.teal;
  const IconComponent = tone.Icon;

  return (
    <section className="panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">{metric.label}</p>
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-black/5 ${tone.wrapBg} ${tone.iconText}`}
        >
          <IconComponent size={17} />
        </span>
      </div>
      <div className="mt-4">
        <p className="tabular-nums text-3xl font-bold text-slate-950">
          {metric.value}
        </p>
        <p className={`mt-1.5 text-xs font-bold ${tone.deltaText}`}>
          {metric.delta}
        </p>
      </div>
    </section>
  );
}

