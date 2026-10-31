import { asyncHandler } from "../utils/asyncHandler.js";
import { getDashboardAnalytics } from "../services/analyticsService.js";

const normalizeTrendRange = (value) => {
  const range = String(value || "").trim().toLowerCase();
  if (["daily", "weekly", "monthly", "last_3_months"].includes(range)) return range;
  return "weekly";
};

export const dashboard = asyncHandler(async (req, res) => {
  const analytics = await getDashboardAnalytics({
    tenant: req.tenant,
    branchId: req.query.branchId,
    range: normalizeTrendRange(req.query.range)
  });
  res.json(analytics);
});
