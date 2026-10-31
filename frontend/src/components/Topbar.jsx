import { Bell, Building2, Menu, Search } from "lucide-react";
import { useState } from "react";
import mehmanMark from "../assets/mehman-mark.webp";

export function Topbar({
  activeTitle,
  onOpenMenu,
  user,
  inboxCount = 0,
  notifications = [],
  notificationsOpen = false,
  notificationsLoading = false,
  onToggleNotifications,
  onNotificationClick,
  onMarkAllNotificationsRead,
  subscriptionNotice = null,
  searchItems = [],
  onSearchSelect
}) {
  const [query, setQuery] = useState("");
  const initials = (user?.name || "A")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const portalLabel =
    user?.role === "SUPER_ADMIN" ? "Mehman SaaS Control" : "Mehman Operations";
  const filterLabel = user?.role === "SUPER_ADMIN" ? "All Clients" : "All Gates";
  const matches = query.trim()
    ? searchItems
      .filter((item) => `${item.label} ${item.group || ""}`.toLowerCase().includes(query.trim().toLowerCase()))
      .slice(0, 6)
    : [];

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMenu}
          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
        <div className="hidden h-9 w-9 overflow-hidden rounded-lg border border-slate-200 bg-white sm:grid sm:place-items-center">
          <img src={mehmanMark} alt="Mehman logo" className="h-full w-full object-contain p-1" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">{portalLabel}</p>
          <h2 className="mt-0.5 text-xl font-bold leading-tight text-slate-900">{activeTitle}</h2>
        </div>
      </div>

      {subscriptionNotice ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          {subscriptionNotice}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex min-w-[180px] flex-1 sm:flex-none sm:min-w-60">
          <label className="field-glass flex h-10 w-full items-center gap-2 rounded-xl px-3">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400"
              placeholder="Search module or workflow..."
              style={{ outline: "none" }}
            />
          </label>
          {matches.length > 0 ? (
            <div className="absolute right-0 top-12 z-40 w-full min-w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40">
              {matches.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onSearchSelect?.(item);
                    setQuery("");
                  }}
                  className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                >
                  <Search size={14} className="mt-0.5 shrink-0 text-blue-600" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">{item.label}</span>
                    <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.group}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="field-glass flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-600">
          <Building2 size={14} className="text-slate-400" />
          {filterLabel}
        </div>

        <div className="relative">
          <button
            onClick={onToggleNotifications}
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="Open notifications"
          >
            <Bell size={16} />
            {inboxCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                {inboxCount > 9 ? "9+" : inboxCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-12 z-40 w-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-bold text-slate-900">Notifications</p>
                <div className="flex items-center gap-2">
                  {inboxCount > 0 ? (
                    <button
                      type="button"
                      onClick={onMarkAllNotificationsRead}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
                    >
                      Mark all read
                    </button>
                  ) : null}
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                    {inboxCount}
                  </span>
                </div>
              </div>

              <div className="max-h-[24rem] overflow-y-auto">
                {notificationsLoading ? (
                  <p className="px-4 py-5 text-sm text-slate-500">Loading notifications...</p>
                ) : notifications.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-slate-500">No notifications right now.</p>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onNotificationClick?.(item)}
                      className="w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm font-semibold ${item.isUnread ? "text-slate-900" : "text-slate-700"}`}>
                          {item.title}
                        </p>
                        {item.isUnread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                      </div>
                      {item.body ? <p className="mt-1 text-xs text-slate-500">{item.body}</p> : null}
                      <p className="mt-1 text-[11px] text-slate-400">{item.timeLabel}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-[11px] font-bold text-white shadow-sm ring-1 ring-blue-500/20">
          {initials}
        </div>
      </div>
    </header>
  );
}

