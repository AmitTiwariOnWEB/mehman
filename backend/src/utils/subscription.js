const VALID_PLANS = ["STARTER", "GROWTH", "ENTERPRISE", "CUSTOM"];
const VALID_CYCLES = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"];
const VALID_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"];
const VALID_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];
const DEFAULT_PLAN_AMOUNT = {
  STARTER: 1499,
  GROWTH: 3499,
  ENTERPRISE: 8999,
  CUSTOM: 0
};

const safeObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};
const toFiniteNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getDefaultExpiry = (startsAt, billingCycle = "MONTHLY") => {
  const cycle = String(billingCycle || "MONTHLY").toUpperCase();
  if (cycle === "YEARLY") return addMonths(startsAt, 12);
  if (cycle === "QUARTERLY") return addMonths(startsAt, 3);
  if (cycle === "ONE_TIME") return addMonths(startsAt, 12);
  return addMonths(startsAt, 1);
};

const getWarningThresholdDays = (subscription) => {
  if (subscription.status === "TRIAL") return 10;
  if (subscription.billingCycle === "MONTHLY") return 7;
  if (subscription.billingCycle === "QUARTERLY") return 15;
  return 30;
};

export const getSubscriptionWarning = (subscription) => {
  if (!subscription?.expiresAt) {
    return { daysRemaining: null, warningDays: 0, shouldWarn: false, expired: false, message: "" };
  }
  const daysRemaining = Math.ceil((subscription.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const warningDays = getWarningThresholdDays(subscription);
  const expired = daysRemaining < 0;
  const shouldWarn = !expired && daysRemaining <= warningDays;
  const label = subscription.status === "TRIAL" ? "Demo" : "Subscription";
  return {
    daysRemaining,
    warningDays,
    shouldWarn,
    expired,
    message: expired
      ? `${label} expired. Service is stopped.`
      : shouldWarn
        ? `${label} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`
        : ""
  };
};

export const getNormalizedSubscription = (settings = {}) => {
  const source = safeObject(safeObject(settings).subscription);
  const now = new Date();
  const startsAt = toDateOrNull(source.startsAt) || now;
  const normalizedPlan = VALID_PLANS.includes(String(source.plan || "").toUpperCase()) ? String(source.plan).toUpperCase() : "STARTER";
  const parsedAmount = toFiniteNumberOrNull(source.amount);
  const amount = parsedAmount !== null && parsedAmount >= 0 ? parsedAmount : DEFAULT_PLAN_AMOUNT[normalizedPlan] || 0;
  const normalizedCurrency = VALID_CURRENCIES.includes(String(source.currency || "").toUpperCase())
    ? String(source.currency).toUpperCase()
    : "INR";

  const billingCycle = VALID_CYCLES.includes(String(source.billingCycle || "").toUpperCase())
    ? String(source.billingCycle).toUpperCase()
    : "MONTHLY";
  const expiresAt = toDateOrNull(source.expiresAt) || getDefaultExpiry(startsAt, billingCycle);

  return {
    plan: normalizedPlan,
    billingCycle,
    status: VALID_STATUSES.includes(String(source.status || "").toUpperCase()) ? String(source.status).toUpperCase() : "ACTIVE",
    amount,
    currency: normalizedCurrency,
    startsAt,
    expiresAt,
    notes: String(source.notes || "").trim()
  };
};

export const applySubscriptionToSettings = (settings = {}, partial = {}) => {
  const base = getNormalizedSubscription(settings);
  const next = {
    ...base,
    ...(partial.plan ? { plan: String(partial.plan).toUpperCase() } : {}),
    ...(partial.billingCycle ? { billingCycle: String(partial.billingCycle).toUpperCase() } : {}),
    ...(partial.status ? { status: String(partial.status).toUpperCase() } : {}),
    ...(partial.amount !== undefined ? { amount: Math.max(0, Number(partial.amount) || 0) } : {}),
    ...(partial.currency ? { currency: String(partial.currency).toUpperCase() } : {}),
    ...(partial.startsAt ? { startsAt: toDateOrNull(partial.startsAt) || base.startsAt } : {}),
    ...(partial.expiresAt ? { expiresAt: toDateOrNull(partial.expiresAt) || base.expiresAt } : {}),
    ...(partial.notes !== undefined ? { notes: String(partial.notes || "").trim() } : {})
  };

  const root = safeObject(settings);
  return {
    ...root,
    subscription: {
      plan: next.plan,
      billingCycle: next.billingCycle,
      status: next.status,
      amount: next.amount,
      currency: next.currency,
      startsAt: next.startsAt.toISOString(),
      expiresAt: next.expiresAt.toISOString(),
      notes: next.notes
    }
  };
};

export const activateDemoSubscriptionSettings = (settings = {}) => {
  const now = new Date();
  return applySubscriptionToSettings(settings, {
    plan: "STARTER",
    billingCycle: "MONTHLY",
    status: "TRIAL",
    amount: 0,
    currency: "INR",
    startsAt: now,
    expiresAt: addDays(now, 10),
    notes: "10-day demo activated by Super Admin."
  });
};

export const resumePaidSubscriptionSettings = (settings = {}) => {
  const base = getNormalizedSubscription(settings);
  const now = new Date();
  const expiresAt = base.expiresAt && base.expiresAt > now ? base.expiresAt : getDefaultExpiry(now, base.billingCycle);
  return applySubscriptionToSettings(settings, {
    status: "ACTIVE",
    startsAt: now,
    expiresAt,
    amount: base.amount
  });
};

export const evaluateCompanyAccess = (company) => {
  if (!company) return { allowed: true, reason: null, subscription: null, effectiveStatus: "ACTIVE" };
  if (company.isActive === false) {
    const subscription = getNormalizedSubscription(company.settings || {});
    return { allowed: false, reason: "company_inactive", subscription, effectiveStatus: "SUSPENDED" };
  }

  const subscription = getNormalizedSubscription(company.settings || {});
  const now = new Date();
  const expired = subscription.expiresAt && now > subscription.expiresAt;
  const hardBlocked = ["SUSPENDED", "CANCELLED", "EXPIRED"].includes(subscription.status);

  if (hardBlocked) {
    return { allowed: false, reason: "subscription_blocked", subscription, effectiveStatus: subscription.status, warning: getSubscriptionWarning(subscription) };
  }

  if (expired) {
    return { allowed: false, reason: "subscription_expired", subscription, effectiveStatus: "EXPIRED", warning: getSubscriptionWarning(subscription) };
  }

  return { allowed: true, reason: null, subscription, effectiveStatus: subscription.status, warning: getSubscriptionWarning(subscription) };
};

export const getSubscriptionConstants = () => ({
  plans: [...VALID_PLANS],
  cycles: [...VALID_CYCLES],
  statuses: [...VALID_STATUSES],
  currencies: [...VALID_CURRENCIES]
});
