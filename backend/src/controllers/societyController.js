import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  activateDemoSubscriptionSettings,
  applySubscriptionToSettings,
  evaluateCompanyAccess,
  getNormalizedSubscription,
  getSubscriptionConstants,
  resumePaidSubscriptionSettings
} from "../utils/subscription.js";

export const onboardSocietySchema = z.object({
  body: z.object({
    clientType: z.enum(["SOCIETY", "CORPORATE"]).optional(),
    societyName: z.string().min(2),
    adminName: z.string().min(2),
    adminEmail: z.string().email(),
    adminPhone: z.string().optional(),
    adminPassword: z.string().min(8),
    address: z.string().min(5),
    demoEnabled: z.boolean().optional()
  })
});

const subscriptionPlans = getSubscriptionConstants().plans;
const subscriptionCycles = getSubscriptionConstants().cycles;
const subscriptionStatuses = getSubscriptionConstants().statuses;
const subscriptionCurrencies = getSubscriptionConstants().currencies;
const clientTypes = ["SOCIETY", "CORPORATE"];

export const updateSocietySubscriptionSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    plan: z.enum(subscriptionPlans).optional(),
    billingCycle: z.enum(subscriptionCycles).optional(),
    status: z.enum(subscriptionStatuses).optional(),
    amount: z.coerce.number().min(0).max(99999999).optional(),
    currency: z.enum(subscriptionCurrencies).optional(),
    startsAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    notes: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
    quickAction: z.enum(["ACTIVATE_DEMO", "SUSPEND_SERVICE", "RESUME_SERVICE"]).optional()
  })
});

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

const uniqueSocietySlug = async (name) => {
  const base = slugify(name) || `society-${Date.now()}`;
  let slug = base;
  let suffix = 2;

  while (await prisma.company.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

export const onboardSociety = asyncHandler(async (req, res) => {
  const role = await prisma.role.findUnique({ where: { name: "SOCIETY_ADMIN" } });
  if (!role) return res.status(500).json({ message: "SOCIETY_ADMIN role is not seeded" });

  const clientType = clientTypes.includes(req.validated.body.clientType) ? req.validated.body.clientType : "SOCIETY";
  const demoEnabled = Boolean(req.validated.body.demoEnabled);
  const passwordHash = await bcrypt.hash(req.validated.body.adminPassword, 12);
  const slug = await uniqueSocietySlug(req.validated.body.societyName);
  const initialSettings = demoEnabled
    ? activateDemoSubscriptionSettings({ clientType })
    : applySubscriptionToSettings({ clientType }, { status: "ACTIVE", plan: "STARTER", billingCycle: "MONTHLY", amount: 1499, currency: "INR" });

  const result = await prisma.$transaction(async (tx) => {
    const society = await tx.company.create({
      data: {
        name: req.validated.body.societyName,
        slug,
        billingEmail: req.validated.body.adminEmail,
        settings: initialSettings
      }
    });

    const admin = await tx.user.create({
      data: {
        companyId: society.id,
        branchId: null,
        roleId: role.id,
        name: req.validated.body.adminName,
        email: req.validated.body.adminEmail.toLowerCase(),
        phone: req.validated.body.adminPhone,
        passwordHash,
        mustChangePassword: true
      },
      include: { role: true }
    });

    return { society, admin };
  });

  res.status(201).json({
    message: `${clientType === "CORPORATE" ? "Corporate" : "Society"} admin login created`,
    society: result.society,
    admin: {
      id: result.admin.id,
      name: result.admin.name,
      email: result.admin.email,
      role: result.admin.role.name
    }
  });
});

export const listSocieties = asyncHandler(async (req, res) => {
  const societies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      branches: true,
      users: { include: { role: true } },
      _count: { select: { users: true, branches: true, visitors: true, gatepasses: true, flats: true } }
    }
  });

  res.json({
    societies: societies.map((society) => {
      const admin = society.users.find((user) => user.role.name === "SOCIETY_ADMIN");
      return {
        ...(() => {
          const access = evaluateCompanyAccess(society);
          const subscription = getNormalizedSubscription(society.settings || {});
          return {
            subscription: {
              ...subscription,
              startsAt: subscription.startsAt.toISOString(),
              expiresAt: subscription.expiresAt.toISOString(),
              effectiveStatus: access.effectiveStatus,
              warning: access.warning || null,
              accessAllowed: access.allowed,
              accessReason: access.reason
            }
          };
        })(),
        id: society.id,
        clientType: clientTypes.includes(society.settings?.clientType) ? society.settings.clientType : "SOCIETY",
        name: society.name,
        slug: society.slug,
        billingEmail: society.billingEmail,
        isActive: society.isActive,
        createdAt: society.createdAt,
        admin: admin ? { id: admin.id, name: admin.name, email: admin.email, phone: admin.phone } : null,
        gates: society._count.branches,
        users: society._count.users,
        visitors: society._count.visitors,
        gatepasses: society._count.gatepasses,
        flats: society._count.flats
      };
    })
  });
});

export const updateSocietySubscription = asyncHandler(async (req, res) => {
  const existing = await prisma.company.findUnique({
    where: { id: req.validated.params.id },
    select: { id: true, settings: true, isActive: true }
  });

  if (!existing) {
    return res.status(404).json({ message: "Society not found" });
  }

  const { quickAction, isActive, ...subscriptionUpdate } = req.validated.body;
  let settings = applySubscriptionToSettings(existing.settings || {}, subscriptionUpdate);
  if (quickAction === "ACTIVATE_DEMO") {
    settings = activateDemoSubscriptionSettings(existing.settings || {});
  } else if (quickAction === "SUSPEND_SERVICE") {
    settings = applySubscriptionToSettings(existing.settings || {}, { status: "SUSPENDED", notes: "Service stopped by Super Admin." });
  } else if (quickAction === "RESUME_SERVICE") {
    settings = resumePaidSubscriptionSettings(existing.settings || {});
  }

  const society = await prisma.company.update({
    where: { id: existing.id },
    data: {
      settings,
      ...(isActive !== undefined ? { isActive } : {})
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      settings: true,
      billingEmail: true
    }
  });

  const access = evaluateCompanyAccess(society);
  const subscription = getNormalizedSubscription(society.settings || {});

  res.json({
    message: "Society subscription updated",
    society: {
      ...society,
      subscription: {
        ...subscription,
        startsAt: subscription.startsAt.toISOString(),
        expiresAt: subscription.expiresAt.toISOString(),
        effectiveStatus: access.effectiveStatus,
        warning: access.warning || null,
        accessAllowed: access.allowed,
        accessReason: access.reason
      }
    }
  });
});
