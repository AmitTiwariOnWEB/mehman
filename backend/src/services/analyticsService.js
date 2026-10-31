import dayjs from "dayjs";
import { prisma } from "../config/prisma.js";

const companyFilter = (tenant, branchId) => ({
  ...(tenant.isSuperAdmin ? {} : { companyId: tenant.companyId }),
  ...(branchId ? { branchId } : {})
});

const trendConfigByRange = (range) => {
  const now = dayjs();

  if (range === "daily") {
    return {
      label: "This month (date-wise)",
      cardFrom: now.startOf("day"),        // cards show TODAY only
      from: now.startOf("month"),          // chart shows all days this month
      buckets: now.date(),
      unit: "day",
      keyFormat: "YYYY-MM-DD",
      labelFormat: "DD MMM"
    };
  }

  if (range === "monthly") {
    return {
      label: "This year (month-wise)",
      cardFrom: now.startOf("year"),
      from: now.startOf("year"),
      buckets: now.month() + 1,
      unit: "month",
      keyFormat: "YYYY-MM",
      labelFormat: "MMM YYYY"
    };
  }

  if (range === "last_3_months") {
    return {
      label: "Last 3 months",
      cardFrom: now.subtract(2, "month").startOf("month"),
      from: now.subtract(2, "month").startOf("month"),
      buckets: 3,
      unit: "month",
      keyFormat: "YYYY-MM",
      labelFormat: "MMM YYYY"
    };
  }

  // weekly — last 7 days
  return {
    label: "Last 7 days",
    cardFrom: now.subtract(6, "day").startOf("day"),
    from: now.subtract(6, "day").startOf("day"),
    buckets: 7,
    unit: "day",
    keyFormat: "YYYY-MM-DD",
    labelFormat: "DD MMM"
  };
};

const countByKey = (rows, dateKey, keyFormat) =>
  rows.reduce((acc, row) => {
    const key = dayjs(row[dateKey]).format(keyFormat);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const buildTrend = ({ range, visitorsForTrend, entriesForTrend }) => {
  const config = trendConfigByRange(range);
  const visitorCountByKey = countByKey(visitorsForTrend, "createdAt", config.keyFormat);
  const entryCountByKey = countByKey(entriesForTrend, "occurredAt", config.keyFormat);

  const trend = Array.from({ length: config.buckets }, (_, index) => {
    const point = config.from.add(index, config.unit);
    const key = point.format(config.keyFormat);
    return {
      day: point.format(config.labelFormat),
      key,
      visitors: visitorCountByKey[key] || 0,
      entries: entryCountByKey[key] || 0
    };
  });

  return { trend, trendLabel: config.label, trendRange: range };
};

export const getDashboardAnalytics = async ({ tenant, branchId, range = "weekly" }) => {
  const trendConfig = trendConfigByRange(range);
  const from = trendConfig.from.toDate();
  const cardFrom = trendConfig.cardFrom.toDate(); // separate date for card counts
  const filter = companyFilter(tenant, branchId);
  const cardDateFilter = { gte: cardFrom };

  const [totalVisitors, activeVisitors, entryLogs, exitLogs, recentLogs, branchActivity, visitorsForTrend, entriesForTrend] =
    await Promise.all([
      prisma.visitor.count({ where: { ...filter, createdAt: cardDateFilter } }),
      prisma.gatepass.count({ where: { ...filter, status: { in: ["ACTIVE", "CHECKED_IN"] } } }), // always live
      prisma.entryLog.count({ where: { ...filter, action: "ENTRY", occurredAt: cardDateFilter } }),
      prisma.entryLog.count({ where: { ...filter, action: "EXIT", occurredAt: cardDateFilter } }),
      prisma.entryLog.findMany({
        where: filter,
        orderBy: { occurredAt: "desc" },
        take: 8,
        include: { gatepass: { include: { visitor: true } }, branch: true, loggedBy: true }
      }),
      prisma.entryLog.groupBy({
        by: ["branchId", "action"],
        where: { ...filter, occurredAt: { gte: from } },
        _count: { _all: true }
      }),
      prisma.visitor.findMany({
        where: { ...filter, createdAt: { gte: from } },
        select: { createdAt: true }
      }),
      prisma.entryLog.findMany({
        where: { ...filter, action: "ENTRY", occurredAt: { gte: from } },
        select: { occurredAt: true }
      })
    ]);

  const trendPayload = buildTrend({ range, visitorsForTrend, entriesForTrend });

  return {
    cards: { totalVisitors, activeVisitors, entryLogs, exitLogs },
    recentLogs,
    branchActivity,
    trend: trendPayload.trend,
    trendLabel: trendPayload.trendLabel,
    trendRange: trendPayload.trendRange
  };
};
