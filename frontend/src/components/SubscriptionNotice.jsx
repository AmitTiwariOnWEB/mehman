export function SubscriptionNotice({ session }) {
  const subscription = session?.user?.company?.subscription;
  const warning = subscription?.warning;
  if (!warning?.shouldWarn || !warning.message) return null;

  const days = Number(warning.daysRemaining);
  const dayLabel = Number.isFinite(days) ? `${days} day${days === 1 ? "" : "s"}` : "ending soon";
  const prefix = subscription?.effectiveStatus === "TRIAL" ? "Demo" : "Subscription";

  return (
    <div className="subscription-alert shrink-0">
      <span className="subscription-alert-dot" />
      <span className="truncate">{prefix}: {dayLabel} left</span>
    </div>
  );
}
