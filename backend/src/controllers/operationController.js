import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { writeAudit } from "../services/auditService.js";
import { createBulkInAppNotifications, createInAppNotification } from "../services/notificationService.js";

const jsonObject = z.record(z.any()).optional();
const jsonArray = z.array(z.any()).optional();
const DATA_IMAGE_PATTERN = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/i;
const normalize = (value = "") => String(value).trim().toLowerCase();
const getRequestOrigin = (req) => `${req.protocol}://${req.get("host")}`;
const persistDataImage = async ({ req, value, folder = "operation-images" }) => {
  const raw = String(value || "").trim();
  const match = raw.match(DATA_IMAGE_PATTERN);
  if (!match) return raw || "";

  const extension = match[1].toLowerCase().replace("jpeg", "jpg");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length) return "";

  const uploadRoot = path.resolve(process.cwd(), "uploads", folder);
  await fs.mkdir(uploadRoot, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  await fs.writeFile(path.join(uploadRoot, filename), buffer);
  return `${getRequestOrigin(req)}/uploads/${folder}/${filename}`;
};
const persistOperationPayloadImages = async (req, payload = {}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload || {};
  const nextPayload = { ...payload };
  for (const key of ["photoUrl", "imageUrl", "vehiclePhotoUrl", "staffPhotoUrl"]) {
    if (typeof nextPayload[key] === "string" && nextPayload[key].startsWith("data:image/")) {
      nextPayload[key] = await persistDataImage({ req, value: nextPayload[key] });
    }
  }
  return nextPayload;
};
const parseJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};
const cleanJsonValue = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(cleanJsonValue).filter((item) => item !== undefined);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, cleanJsonValue(item)])
        .filter(([, item]) => item !== undefined)
    );
  }
  return value;
};
const categoryIncludes = (value, fragment) => normalize(value).includes(normalize(fragment));
const isAnnouncementCategory = (value) => categoryIncludes(value, "announcement");
const isDirectoryCategory = (value) => categoryIncludes(value, "directory");
const isComplaintCategory = (value) => categoryIncludes(value, "complaint");
const isMaintenanceBillingCategory = (value) => categoryIncludes(value, "maintenance billing");
const isMaintenanceCategory = (value) => categoryIncludes(value, "maintenance");
const isAmenityBookingCategory = (value) => categoryIncludes(value, "amenity");
const isEmergencyCategory = (value) => categoryIncludes(value, "emergency");
const isResidentSuiteCategory = (value) => categoryIncludes(value, "resident suite") || categoryIncludes(value, "household");
const isVotingCategory = (value) => categoryIncludes(value, "voting");
const isAmenityBookingPayload = (payload = {}) =>
  String(payload.requestType || "").toUpperCase() === "AMENITY_BOOKING" ||
  categoryIncludes(payload.feature, "amenities booking") ||
  categoryIncludes(payload.feature, "amenity booking");
const isAmenityBookingRecord = (record = {}) => isAmenityBookingCategory(record.category) || isAmenityBookingPayload(parseJsonObject(record.payload));
const isResidentServiceCategory = (value) =>
  ["complaint", "maintenance", "amenity", "feedback", "emergency", "resident suite", "household"].some((item) => categoryIncludes(value, item));
const isSocietyAdmin = (req) => ["SOCIETY_ADMIN", "COMPANY_ADMIN", "SUPER_ADMIN"].includes(req.user.role.name);
const canManageAnnouncements = (req) => isSocietyAdmin(req);
const queryableRoleNames = new Set(["SUPER_ADMIN", "SOCIETY_ADMIN", "SECURITY_GUARD", "FLAT_OWNER", "RECEPTIONIST"]);
const announcementAudienceRoles = ["FLAT_OWNER", "SOCIETY_ADMIN", "SUPER_ADMIN", "RECEPTIONIST"];

const getCompanyUserIdsByRoles = async ({ companyId, roles = [] }) => {
  if (!companyId) return [];
  const validRoles = roles.filter((role) => queryableRoleNames.has(role));
  const users = await prisma.user.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      ...(validRoles.length > 0 ? { role: { name: { in: validRoles } } } : roles.length > 0 ? { id: { in: [] } } : {})
    },
    select: { id: true }
  });
  return users.map((user) => user.id);
};

const getValidBranchId = async ({ companyId, branchId }) => {
  if (!companyId || !branchId) return null;
  const branch = await prisma.branch.findFirst({
    where: { id: String(branchId), companyId, isActive: true },
    select: { id: true }
  });
  return branch?.id || null;
};

const runOperationSideEffect = async (label, task) => {
  try {
    return await task();
  } catch (error) {
    console.error(`Operation side effect failed: ${label}`, {
      name: error?.name,
      code: error?.code,
      message: error?.message
    });
    return null;
  }
};

const getEmergencyResponderUserIds = async ({ companyId, branchId }) => {
  if (!companyId) return [];
  const [admins, onDutyGuards] = await Promise.all([
    getCompanyUserIdsByRoles({ companyId, roles: ["SOCIETY_ADMIN", "COMPANY_ADMIN", "SUPER_ADMIN"] }),
    prisma.guard.findMany({
      where: {
        companyId,
        isOnDuty: true,
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {})
      },
      select: { userId: true }
    })
  ]);

  let guardIds = onDutyGuards.map((guard) => guard.userId).filter(Boolean);
  if (guardIds.length === 0) {
    guardIds = await getCompanyUserIdsByRoles({ companyId, roles: ["SECURITY_GUARD"] });
  }

  return [...new Set([...admins, ...guardIds].filter(Boolean))];
};

const getTargetedFlatAudience = async ({ companyId, payload = {} }) => {
  const targetScope = String(payload.targetScope || "").toUpperCase();
  const target = payload.target || {};
  if (!companyId || !targetScope) return { flatIds: [], userIds: [] };

  const where = { companyId, isActive: true };
  if (target.branchId) where.branchId = String(target.branchId);

  if (targetScope === "FLAT") {
    if (target.flatId) where.id = String(target.flatId);
    else if (target.flatNumber) where.flatNumber = String(target.flatNumber);
    else return { flatIds: [], userIds: [] };
  }

  if (targetScope === "FLOOR") {
    if (target.tower) where.tower = String(target.tower);
    if (!target.floor) return { flatIds: [], userIds: [] };
    where.floor = String(target.floor);
  }

  if (targetScope === "TOWER") {
    if (!target.tower) return { flatIds: [], userIds: [] };
    where.tower = String(target.tower);
  }

  const flats = await prisma.flat.findMany({
    where,
    select: { id: true, ownerId: true, owner2Id: true }
  });

  const flatIds = flats.map((flat) => flat.id);
  const userIds = [...new Set(flats.flatMap((flat) => [flat.ownerId, flat.owner2Id]).filter(Boolean))];
  return { flatIds, userIds };
};

const getFlatForOwner = (companyId, userId) =>
  prisma.flat.findFirst({
    where: {
      companyId,
      isActive: true,
      OR: [{ ownerId: userId }, { owner2Id: userId }]
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, flatNumber: true, tower: true, floor: true, branchId: true }
  });

const getFlatsForOwner = (companyId, userId) =>
  prisma.flat.findMany({
    where: {
      companyId,
      isActive: true,
      OR: [{ ownerId: userId }, { owner2Id: userId }]
    },
    select: { id: true, flatNumber: true, tower: true, floor: true, branchId: true }
  });

const getNotificationOperationIdsForUser = async (companyId, userId) => {
  if (!companyId || !userId) return [];
  const notifications = await prisma.notification.findMany({
    where: { companyId, userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { data: true }
  });

  return [
    ...new Set(
      notifications
        .map((notification) => {
          const data = parseJsonObject(notification.data);
          return data.operationId ? String(data.operationId) : "";
        })
        .filter(Boolean)
    )
  ];
};

const extractAmenitySlot = (payload = {}) => {
  const amenity = String(payload.amenity || payload.amenityName || "").trim();
  const date = String(payload.date || payload.bookingDate || "").trim();
  const slot = String(payload.slot || "").trim();
  return { amenity, date, slot };
};

const findApprovedAmenityBooking = async ({ companyId, amenity, date, slot, excludeId }) => {
  const candidates = await prisma.operationalRecord.findMany({
    where: {
      companyId,
      status: "APPROVED",
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      OR: [
        { category: { contains: "Amenity" } },
        { payload: { path: "$.requestType", equals: "AMENITY_BOOKING" } },
        { payload: { path: "$.feature", equals: "Amenities Booking" } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, title: true, payload: true }
  });
  const wantedAmenity = normalize(amenity);
  const wantedDate = normalize(date);
  const wantedSlot = normalize(slot);
  return candidates.find((record) => {
    const payload = parseJsonObject(record.payload);
    return normalize(payload.amenity || payload.amenityName) === wantedAmenity &&
      normalize(payload.date || payload.bookingDate) === wantedDate &&
      normalize(payload.slot) === wantedSlot;
  }) || null;
};

export const createOperationSchema = z.object({
  body: z.object({
    branchId: z.string().uuid().optional(),
    assignedToId: z.string().uuid().optional(),
    category: z.string().min(2).max(80),
    title: z.string().min(2).max(160),
    description: z.string().max(2000).optional(),
    status: z.string().min(2).max(40).optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"),
    payload: jsonObject,
    attachments: jsonArray,
    dueAt: z.coerce.date().optional()
  })
});

export const updateOperationSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    branchId: z.string().uuid().nullable().optional(),
    assignedToId: z.string().uuid().nullable().optional(),
    title: z.string().min(2).max(160).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(["OPEN", "PENDING_APPROVAL", "IN_PROGRESS", "WORKING", "APPROVED", "REJECTED", "RESOLVED", "CLOSED", "CANCELLED"]).optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional(),
    payload: jsonObject,
    attachments: jsonArray,
    dueAt: z.coerce.date().nullable().optional()
  })
});

export const castOperationVoteSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    selectedOption: z.string().min(1).max(120)
  })
});

export const reportOperationPaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    paidDate: z.string().min(4).max(40).optional(),
    paidAt: z.string().min(4).max(80).optional()
  })
});

const companyScope = (req) => (req.tenant.isSuperAdmin ? {} : { companyId: req.user.companyId });
const buildFlatOwnerUpdateScope = (req, ownerFlats = [], notificationOperationIds = []) => {
  if (req.user.role.name !== "FLAT_OWNER") return {};
  const unitServiceVisibility = buildOwnerFlatOperationVisibility(ownerFlats, ["Complaint", "Maintenance", "Resident Suite", "Household", "Amenity"]);
  const maintenanceBillingVisibility = buildMaintenanceBillingVisibility(ownerFlats);
  return {
    OR: [
      { createdById: req.user.id },
      { assignedToId: req.user.id },
      { category: { contains: "Voting" } },
      ...(unitServiceVisibility ? [unitServiceVisibility] : []),
      ...(ownerFlats.length > 0 ? [maintenanceBillingVisibility] : []),
      ...(notificationOperationIds.length > 0 ? [{ id: { in: notificationOperationIds } }] : [])
    ]
  };
};

const buildOwnerFlatOperationVisibility = (ownerFlats = [], categoryFragments = []) => {
  if (!ownerFlats.length) return null;

  const flatMatches = ownerFlats.flatMap((flat) => {
    const matches = [];
    if (flat.id) {
      matches.push({ payload: { path: "$.flatId", equals: flat.id } });
      matches.push({ payload: { path: "$.target.flatId", equals: flat.id } });
    }
    if (flat.flatNumber) {
      matches.push({ payload: { path: "$.flatNumber", equals: flat.flatNumber } });
      matches.push({ payload: { path: "$.target.flatNumber", equals: flat.flatNumber } });
    }
    if (flat.tower) {
      matches.push({
        AND: [
          { payload: { path: "$.targetScope", equals: "TOWER" } },
          { payload: { path: "$.target.tower", equals: flat.tower } }
        ]
      });
    }
    if (flat.tower && flat.floor) {
      matches.push({
        AND: [
          { payload: { path: "$.targetScope", equals: "FLOOR" } },
          { payload: { path: "$.target.tower", equals: flat.tower } },
          { payload: { path: "$.target.floor", equals: flat.floor } }
        ]
      });
    }
    return matches;
  });

  if (!flatMatches.length) return null;

  return {
    AND: [
      { OR: categoryFragments.map((fragment) => ({ category: { contains: fragment } })) },
      { OR: flatMatches }
    ]
  };
};

const buildMaintenanceBillingVisibility = (ownerFlats = []) => {
  const ownerFlatIds = ownerFlats.map((flat) => flat.id).filter(Boolean);
  const ownerFlatNumbers = ownerFlats.map((flat) => flat.flatNumber).filter(Boolean);
  return {
    AND: [
      { category: { contains: "Maintenance Billing" } },
      {
        OR: [
          { payload: { path: "$.targetScope", equals: "ALL" } },
          ...ownerFlatIds.map((flatId) => ({ payload: { path: "$.target.flatId", equals: flatId } })),
          ...ownerFlatIds.map((flatId) => ({ payload: { path: "$.flatId", equals: flatId } })),
          ...ownerFlatNumbers.map((flatNumber) => ({ payload: { path: "$.target.flatNumber", equals: flatNumber } })),
          ...ownerFlatNumbers.map((flatNumber) => ({ payload: { path: "$.flatNumber", equals: flatNumber } }))
        ]
      }
    ]
  };
};

const buildFlatOwnerReadScope = (req, ownerFlats = [], notificationOperationIds = []) => {
  if (req.user.role.name !== "FLAT_OWNER") return {};
  const unitServiceVisibility = buildOwnerFlatOperationVisibility(ownerFlats, ["Complaint", "Maintenance", "Resident Suite", "Household", "Amenity"]);
  const maintenanceBillingVisibility = buildMaintenanceBillingVisibility(ownerFlats);
  return {
    OR: [
      { createdById: req.user.id },
      { assignedToId: req.user.id },
      { category: { contains: "Announcement" } },
      { category: { contains: "Directory" } },
      { category: { contains: "Amenity" }, status: "APPROVED" },
      { category: { contains: "Voting" } },
      ...(unitServiceVisibility ? [unitServiceVisibility] : []),
      ...(notificationOperationIds.length > 0 ? [{ id: { in: notificationOperationIds } }] : []),
      ...(ownerFlats.length > 0 ? [maintenanceBillingVisibility] : [])
    ]
  };
};

const operationInclude = {
  branch: true,
  createdBy: { select: { id: true, name: true, email: true, role: { select: { name: true } } } }
};

const getFlatOwnerWritableOperation = async (req) => {
  const ownerFlats = req.user.role.name === "FLAT_OWNER" ? await getFlatsForOwner(req.user.companyId, req.user.id) : [];
  const notificationOperationIds =
    req.user.role.name === "FLAT_OWNER"
      ? await getNotificationOperationIdsForUser(req.user.companyId, req.user.id)
      : [];
  const flatOwnerUpdateFilter = buildFlatOwnerUpdateScope(req, ownerFlats, notificationOperationIds);
  return prisma.operationalRecord.findFirst({
    where: { id: req.validated.params.id, ...companyScope(req), ...flatOwnerUpdateFilter }
  });
};

const inferSelectedVotingOption = ({ requestedVotes = {}, currentVotes = {}, options = [] }) => {
  const changedOptions = options.filter((option) => Number(requestedVotes[option] || 0) === Number(currentVotes[option] || 0) + 1);
  return changedOptions.length === 1 ? changedOptions[0] : "";
};

const redactResidentVotingRecord = (record, userId) => {
  if (!isVotingCategory(record.category)) return record;
  const payload = record.payload && typeof record.payload === "object" ? record.payload : {};
  const votedBy = Array.isArray(payload.votedBy) ? payload.votedBy : [];
  const hasVoted = votedBy.includes(userId);
  return {
    ...record,
    payload: {
      ...payload,
      votes: {},
      votedBy: hasVoted ? [userId] : [],
      hasVoted
    }
  };
};

export const listOperations = asyncHandler(async (req, res) => {
  const ownerFlats = req.user.role.name === "FLAT_OWNER" ? await getFlatsForOwner(req.user.companyId, req.user.id) : [];
  const notificationOperationIds =
    req.user.role.name === "FLAT_OWNER"
      ? await getNotificationOperationIdsForUser(req.user.companyId, req.user.id)
      : [];
  const flatOwnerFilter = buildFlatOwnerReadScope(req, ownerFlats, notificationOperationIds);
  const createdAt = {};
  if (req.query.from) createdAt.gte = new Date(String(req.query.from));
  if (req.query.to) createdAt.lte = new Date(`${String(req.query.to).slice(0, 10)}T23:59:59.999Z`);
  const hasCreatedAtFilter = Object.keys(createdAt).length > 0;
  const limit = Math.min(Number(req.query.limit) || 100, 5000);

  const where = {
    ...companyScope(req),
    ...(req.query.category ? { category: { contains: String(req.query.category) } } : {}),
    ...(req.query.status ? { status: String(req.query.status) } : {}),
    ...(req.query.branchId ? { branchId: String(req.query.branchId) } : {}),
    ...(hasCreatedAtFilter ? { createdAt } : {}),
    ...flatOwnerFilter
  };

  const records = await prisma.operationalRecord.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: operationInclude
  });

  const responseRecords =
    req.user.role.name === "FLAT_OWNER"
      ? records.map((record) => redactResidentVotingRecord(record, req.user.id))
      : records;

  res.json({ records: responseRecords, operations: responseRecords });
});

export const getOperation = asyncHandler(async (req, res) => {
  const ownerFlats = req.user.role.name === "FLAT_OWNER" ? await getFlatsForOwner(req.user.companyId, req.user.id) : [];
  const notificationOperationIds =
    req.user.role.name === "FLAT_OWNER"
      ? await getNotificationOperationIdsForUser(req.user.companyId, req.user.id)
      : [];
  const flatOwnerFilter = buildFlatOwnerReadScope(req, ownerFlats, notificationOperationIds);

  const record = await prisma.operationalRecord.findFirst({
    where: { id: req.params.id, ...companyScope(req), ...flatOwnerFilter },
    include: operationInclude
  });

  if (!record) return res.status(404).json({ message: "Operational record not found" });
  const responseRecord =
    req.user.role.name === "FLAT_OWNER"
      ? redactResidentVotingRecord(record, req.user.id)
      : record;
  res.json({ record: responseRecord, operation: responseRecord });
});

export const createOperation = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId || req.validated.body.payload?.companyId;
  const category = req.validated.body.category;
  const payload = await persistOperationPayloadImages(req, req.validated.body.payload || {});

  if (!companyId) return res.status(400).json({ message: "Company context is required" });
  if (isAnnouncementCategory(category) && !canManageAnnouncements(req)) {
    return res.status(403).json({ message: "Only society admins can publish announcements" });
  }
  if (isDirectoryCategory(category) && !canManageAnnouncements(req)) {
    return res.status(403).json({ message: "Only society admins can publish directory contacts" });
  }
  if (isVotingCategory(category) && !isSocietyAdmin(req)) {
    return res.status(403).json({ message: "Only society admins can create voting polls" });
  }

  let recordPayload = payload;
  let status = req.validated.body.status || "OPEN";
  const requestedBranchId = req.validated.body.branchId || payload.branchId || req.user.branchId || null;
  let operationBranchId = await getValidBranchId({ companyId, branchId: requestedBranchId });
  if (isEmergencyCategory(category)) {
    status = "OPEN";
  }

  const isAmenityBookingRequest = isAmenityBookingCategory(category) || isAmenityBookingPayload(payload);
  if (isAmenityBookingRequest) {
    const { amenity, date, slot } = extractAmenitySlot(payload);
    if (!amenity || !date || !slot) {
      return res.status(422).json({ message: "Amenity booking requires amenity, date, and slot" });
    }

    if (req.user.role.name === "FLAT_OWNER") {
      status = "PENDING_APPROVAL";
      const ownerFlat = await getFlatForOwner(companyId, req.user.id);
      operationBranchId = operationBranchId || await getValidBranchId({ companyId, branchId: ownerFlat?.branchId });
      recordPayload = {
        ...payload,
        amenity,
        date,
        slot,
        flatId: payload.flatId || ownerFlat?.id || null,
        flatNumber: payload.flatNumber || ownerFlat?.flatNumber || "",
        tower: payload.tower || ownerFlat?.tower || "",
        floor: payload.floor || ownerFlat?.floor || "",
        branchId: operationBranchId
      };
    }

    const existingApproved = await findApprovedAmenityBooking({ companyId, amenity, date, slot });
    if (existingApproved) {
      return res.status(409).json({ message: "This amenity slot is already booked for the selected time" });
    }
  }

  if (isResidentServiceCategory(category) && req.user.role.name === "FLAT_OWNER" && !isMaintenanceBillingCategory(category)) {
    const ownerFlat = await getFlatForOwner(companyId, req.user.id);
    if (!ownerFlat && !payload.flatNumber && !payload.flatId) {
      return res.status(422).json({ message: "No active flat is mapped to this resident account" });
    }
    operationBranchId = operationBranchId || await getValidBranchId({ companyId, branchId: ownerFlat?.branchId });

    recordPayload = {
      ...payload,
      source: payload.source || "resident-app",
      residentUserId: req.user.id,
      residentName: req.user.name,
      flatId: payload.flatId || ownerFlat?.id || null,
      flatNumber: payload.flatNumber || ownerFlat?.flatNumber || "",
      tower: payload.tower || ownerFlat?.tower || "",
      floor: payload.floor || ownerFlat?.floor || "",
      branchId: operationBranchId,
      targetScope: payload.targetScope || "FLAT",
      target: payload.target || {
        flatId: payload.flatId || ownerFlat?.id || null,
        flatNumber: payload.flatNumber || ownerFlat?.flatNumber || "",
        tower: payload.tower || ownerFlat?.tower || "",
        floor: payload.floor || ownerFlat?.floor || "",
        branchId: operationBranchId
      }
    };
  }

  if ((isComplaintCategory(category) || isMaintenanceCategory(category)) && isSocietyAdmin(req)) {
    recordPayload = { ...recordPayload, targetScope: recordPayload.targetScope || "FLAT", target: recordPayload.target || {} };
  }

  if (isResidentSuiteCategory(category) && req.user.role.name === "FLAT_OWNER") {
    const ownerFlat = await getFlatForOwner(companyId, req.user.id);
    if (!ownerFlat) {
      return res.status(422).json({ message: "No active flat is mapped to this resident account" });
    }

    const feature = String(payload.feature || req.validated.body.title || "").trim();
    const normalizedFeature = feature || "Household Record";

    recordPayload = {
      ...payload,
      source: payload.source || "resident-app",
      feature: normalizedFeature,
      residentUserId: req.user.id,
      residentName: req.user.name,
      flatId: payload.flatId || ownerFlat.id,
      flatNumber: payload.flatNumber || ownerFlat.flatNumber,
      tower: payload.tower || ownerFlat.tower || "",
      floor: payload.floor || ownerFlat.floor || "",
      branchId: payload.branchId || ownerFlat.branchId || null
    };
  }

  const record = await prisma.operationalRecord.create({
    data: {
      ...req.validated.body,
      companyId,
      branchId: operationBranchId,
      createdById: req.user.id,
      status,
      payload: cleanJsonValue(recordPayload) || {},
      attachments: cleanJsonValue(req.validated.body.attachments) || []
    },
    include: { branch: true, createdBy: { select: { id: true, name: true, email: true, role: { select: { name: true } } } } }
  });

  await runOperationSideEffect("operation create audit and notifications", async () => {
    await writeAudit({
      req,
      action: "OPERATION_CREATED",
      entityType: "OperationalRecord",
      entityId: record.id,
      metadata: { category: record.category, status: record.status }
    });

    if (record.assignedToId && record.assignedToId !== req.user.id) {
      await createInAppNotification({
        companyId,
        userId: record.assignedToId,
        title: record.title,
        body: record.description || "New approval request",
        data: { operationId: record.id, category: record.category, status: record.status }
      });
    }

  if (isAmenityBookingRecord(record) && req.user.role.name === "FLAT_OWNER") {
      const societyAdmins = await getCompanyUserIdsByRoles({
        companyId,
        roles: ["SOCIETY_ADMIN", "COMPANY_ADMIN", "SUPER_ADMIN"]
      });
      await createBulkInAppNotifications({
        companyId,
        userIds: societyAdmins.filter((id) => id !== req.user.id),
        title: `Amenity approval needed: ${record.title}`,
        body: record.description || "A resident submitted an amenity booking request.",
        data: { operationId: record.id, category: record.category, status: record.status, event: "approval_required" }
      });
    }

    if ((isComplaintCategory(record.category) || isMaintenanceCategory(record.category)) && isSocietyAdmin(req)) {
      const targetAudience = await getTargetedFlatAudience({ companyId, payload: record.payload || {} });
      if (targetAudience.userIds.length > 0) {
        await createBulkInAppNotifications({
          companyId,
          userIds: targetAudience.userIds.filter((id) => id !== req.user.id),
          title: `${record.category}: ${record.title}`,
          body: record.description || "A society update is relevant for your unit.",
          data: {
            operationId: record.id,
            category: record.category,
            status: record.status,
            event: "targeted_flat_notice",
            targetScope: record.payload?.targetScope || null,
            flatIds: targetAudience.flatIds
          }
        });
      }
    }

    if (isEmergencyCategory(record.category)) {
      const responders = await getEmergencyResponderUserIds({
        companyId,
        branchId: record.payload?.branchId || record.branchId || null
      });
      await createBulkInAppNotifications({
        companyId,
        userIds: responders.filter((id) => id !== req.user.id),
        title: `Emergency SOS: ${record.payload?.flatNumber || record.title}`,
        body: `${record.payload?.residentName || req.user.name || "Resident"} needs immediate help${record.description ? ` - ${record.description}` : ""}`,
        data: {
          operationId: record.id,
          category: record.category,
          status: record.status,
          event: "emergency_sos",
          priority: record.priority,
          flatNumber: record.payload?.flatNumber || null,
          branchId: record.payload?.branchId || record.branchId || null
        }
      });
    } else if (isResidentServiceCategory(record.category) && !isAmenityBookingRecord(record)) {
      const adminOnlyResidentService =
        isComplaintCategory(record.category) ||
        isMaintenanceCategory(record.category) ||
        isResidentSuiteCategory(record.category);
      const stakeholders = await getCompanyUserIdsByRoles({
        companyId,
        roles: adminOnlyResidentService
          ? ["SOCIETY_ADMIN", "COMPANY_ADMIN", "SUPER_ADMIN"]
          : ["SOCIETY_ADMIN", "COMPANY_ADMIN", "SUPER_ADMIN", "SECURITY_GUARD"]
      });
      await createBulkInAppNotifications({
        companyId,
        userIds: stakeholders.filter((id) => id !== req.user.id),
        title: `${record.category} submitted`,
        body: `${record.title}${record.description ? ` - ${record.description}` : ""}`,
        data: { operationId: record.id, category: record.category, status: record.status, event: "created" }
      });

      if (req.user.role.name === "FLAT_OWNER") {
        const targetAudience = await getTargetedFlatAudience({ companyId, payload: record.payload || {} });
        await createBulkInAppNotifications({
          companyId,
          userIds: targetAudience.userIds.filter((id) => id !== req.user.id),
          title: `${record.category} submitted`,
          body: `${record.title}${record.description ? ` - ${record.description}` : ""}`,
          data: {
            operationId: record.id,
            category: record.category,
            status: record.status,
            event: "unit_request_created",
            flatIds: targetAudience.flatIds
          }
        });
      }
    }

    if (isAnnouncementCategory(record.category)) {
      const residents = await getCompanyUserIdsByRoles({ companyId, roles: announcementAudienceRoles });
      await createBulkInAppNotifications({
        companyId,
        userIds: residents.filter((id) => id !== req.user.id),
        title: `New announcement: ${record.title}`,
        body: record.description || "A new society announcement has been published.",
        data: { operationId: record.id, category: record.category, status: record.status, event: "announcement_created" }
      });
    }

    if (isDirectoryCategory(record.category)) {
      const residents = await getCompanyUserIdsByRoles({ companyId });
      await createBulkInAppNotifications({
        companyId,
        userIds: residents.filter((id) => id !== req.user.id),
        title: `Directory updated: ${record.title}`,
        body: record.description || "Society contact directory has a new update.",
        data: { operationId: record.id, category: record.category, status: record.status, event: "directory_updated" }
      });
    }

    if (isVotingCategory(record.category)) {
      const residents = await getCompanyUserIdsByRoles({ companyId, roles: ["FLAT_OWNER"] });
      await createBulkInAppNotifications({
        companyId,
        userIds: residents.filter((id) => id !== req.user.id),
        title: `New voting poll: ${record.payload?.topic || record.title}`,
        body: record.payload?.endsAt ? `Vote before ${new Date(record.payload.endsAt).toLocaleString()}.` : "A new society voting poll is available.",
        data: { operationId: record.id, category: record.category, status: record.status, event: "vote_created" }
      });
    }
  });

  res.status(201).json({ record });
});

export const castOperationVote = asyncHandler(async (req, res) => {
  if (req.user.role.name !== "FLAT_OWNER") {
    return res.status(403).json({ message: "Only residents can cast votes" });
  }

  const existing = await getFlatOwnerWritableOperation(req);
  if (!existing || !isVotingCategory(existing.category)) {
    return res.status(404).json({ message: "Voting poll not found" });
  }
  if (existing.status !== "OPEN") {
    return res.status(409).json({ message: "This poll is closed" });
  }

  const existingPayload = parseJsonObject(existing.payload);
  const votingEndsAt = existing.dueAt || existingPayload.endsAt;
  if (votingEndsAt) {
    const parsedEndsAt = new Date(votingEndsAt);
    if (!Number.isNaN(parsedEndsAt.getTime()) && parsedEndsAt.getTime() < Date.now()) {
      return res.status(409).json({ message: "Voting limit has ended" });
    }
  }

  const selectedOption = String(req.validated.body.selectedOption || "").trim();
  const options = Array.isArray(existingPayload.options) ? existingPayload.options : [];
  const currentVotes = existingPayload.votes && typeof existingPayload.votes === "object" ? existingPayload.votes : {};
  const votedBy = Array.isArray(existingPayload.votedBy) ? existingPayload.votedBy : [];

  if (!selectedOption || !options.includes(selectedOption)) {
    return res.status(422).json({ message: "Select a valid poll option" });
  }
  if (votedBy.includes(req.user.id)) {
    return res.status(409).json({ message: "You have already voted in this poll" });
  }

  const record = await prisma.operationalRecord.update({
    where: { id: existing.id },
    data: {
      payload: {
        ...existingPayload,
        votes: {
          ...currentVotes,
          [selectedOption]: Number(currentVotes[selectedOption] || 0) + 1
        },
        votedBy: [...new Set([...votedBy, req.user.id])],
        lastVoteAt: new Date().toISOString(),
        lastVoteBy: req.user.id
      }
    },
    include: operationInclude
  });

  await writeAudit({
    req,
    action: "OPERATION_UPDATED",
    entityType: "OperationalRecord",
    entityId: record.id,
    metadata: { category: record.category, status: record.status, event: "vote_cast" }
  });

  res.json({ record: redactResidentVotingRecord(record, req.user.id) });
});

export const reportOperationPayment = asyncHandler(async (req, res) => {
  if (req.user.role.name !== "FLAT_OWNER") {
    return res.status(403).json({ message: "Only residents can report maintenance bill payments" });
  }

  const existing = await getFlatOwnerWritableOperation(req);
  if (!existing || !isMaintenanceBillingCategory(existing.category)) {
    return res.status(404).json({ message: "Maintenance bill not found" });
  }

  const existingPayload = parseJsonObject(existing.payload);
  if (existingPayload.billState === "PAID" || existing.status === "RESOLVED") {
    return res.status(409).json({ message: "This bill is already marked paid" });
  }
  if (existingPayload.billState === "PAYMENT_REPORTED" || existing.status === "PENDING_APPROVAL") {
    return res.status(409).json({ message: "Payment is already submitted for admin verification" });
  }

  const paidDateValue = req.validated.body.paidAt || req.validated.body.paidDate || new Date().toISOString();
  const paidAt = new Date(paidDateValue);
  if (Number.isNaN(paidAt.getTime())) {
    return res.status(422).json({ message: "Enter a valid paid date" });
  }

  const record = await prisma.operationalRecord.update({
    where: { id: existing.id },
    data: {
      status: "PENDING_APPROVAL",
      payload: {
        ...existingPayload,
        billState: "PAYMENT_REPORTED",
        reportedPaidAt: paidAt.toISOString(),
        reportedPaidDate: paidAt.toISOString().slice(0, 10),
        reportedPaidBy: req.user.id,
        reportedPaidByName: req.user.name,
        paymentDeniedNote: "",
        paymentDeniedAt: ""
      }
    },
    include: operationInclude
  });

  await writeAudit({
    req,
    action: "OPERATION_UPDATED",
    entityType: "OperationalRecord",
    entityId: record.id,
    metadata: { category: record.category, status: record.status, event: "resident_reported_bill_payment" }
  });

  const adminIds = await getCompanyUserIdsByRoles({ companyId: record.companyId, roles: ["SOCIETY_ADMIN", "COMPANY_ADMIN", "SUPER_ADMIN"] });
  await runOperationSideEffect("bill payment report notification", async () => {
    await createBulkInAppNotifications({
      companyId: record.companyId,
      userIds: adminIds.filter((id) => id !== req.user.id),
      title: `Payment verification needed: ${record.payload?.flatNumber || record.payload?.target?.flatNumber || record.title}`,
      body: `${req.user.name || "Resident"} reported payment on ${paidAt.toLocaleDateString()}.`,
      data: { operationId: record.id, category: record.category, status: record.status, event: "bill_payment_reported" }
    });
  });

  res.json({ record });
});

export const updateOperation = asyncHandler(async (req, res) => {
  const isTryingAnnouncementUpdate = isAnnouncementCategory(req.validated.body.category);
  const isTryingDirectoryUpdate = isDirectoryCategory(req.validated.body.category);
  if (isTryingAnnouncementUpdate && !canManageAnnouncements(req)) {
    return res.status(403).json({ message: "Only society admins can update announcements" });
  }
  if (isTryingDirectoryUpdate && !canManageAnnouncements(req)) {
    return res.status(403).json({ message: "Only society admins can update directory contacts" });
  }

  const ownerFlatsForUpdate = req.user.role.name === "FLAT_OWNER" ? await getFlatsForOwner(req.user.companyId, req.user.id) : [];
  const notificationOperationIdsForUpdate =
    req.user.role.name === "FLAT_OWNER"
      ? await getNotificationOperationIdsForUser(req.user.companyId, req.user.id)
      : [];
  const flatOwnerUpdateFilter = buildFlatOwnerUpdateScope(req, ownerFlatsForUpdate, notificationOperationIdsForUpdate);

  const existing = await prisma.operationalRecord.findFirst({
    where: { id: req.validated.params.id, ...companyScope(req), ...flatOwnerUpdateFilter }
  });

  if (!existing) return res.status(404).json({ message: "Operational record not found" });
  if (isAnnouncementCategory(existing.category) && !canManageAnnouncements(req)) {
    return res.status(403).json({ message: "Only society admins can update announcements" });
  }
  if (isDirectoryCategory(existing.category) && !canManageAnnouncements(req)) {
    return res.status(403).json({ message: "Only society admins can update directory contacts" });
  }
  const isFinalServiceRecord =
    ["CLOSED", "RESOLVED"].includes(existing.status) &&
    (isComplaintCategory(existing.category) || (isMaintenanceCategory(existing.category) && !isMaintenanceBillingCategory(existing.category)));
  const requestedStatus = req.validated.body.status;
  if (isFinalServiceRecord && requestedStatus && requestedStatus !== existing.status) {
    return res.status(409).json({ message: "Closed complaints and maintenance requests cannot be reopened" });
  }
  if (isMaintenanceBillingCategory(existing.category) && !isSocietyAdmin(req)) {
    if (req.user.role.name !== "FLAT_OWNER") {
      return res.status(403).json({ message: "Only society admins or assigned residents can update maintenance billing" });
    }

    const allowedKeys = ["status", "payload"];
    if (Object.keys(req.validated.body).some((key) => !allowedKeys.includes(key))) {
      return res.status(403).json({ message: "Residents can only mark their maintenance bill paid" });
    }
    if (req.validated.body.status && req.validated.body.status !== "PENDING_APPROVAL") {
      return res.status(403).json({ message: "Residents can only report their maintenance bill payment" });
    }

    const existingPayload = parseJsonObject(existing.payload);
    if (existingPayload.billState === "PAID" || existing.status === "RESOLVED") {
      return res.status(409).json({ message: "This bill is already marked paid" });
    }
    if (existingPayload.billState === "PAYMENT_REPORTED" || existing.status === "PENDING_APPROVAL") {
      return res.status(409).json({ message: "Payment is already submitted for admin verification" });
    }

    const requestedPayload = await persistOperationPayloadImages(req, parseJsonObject(req.validated.body.payload));
    const paidDateValue =
      requestedPayload.paidAt ||
      requestedPayload.paidDate ||
      requestedPayload.reportedPaidAt ||
      requestedPayload.reportedPaidDate;
    if (!paidDateValue) {
      return res.status(422).json({ message: "Paid date is required" });
    }
    const paidAt = new Date(paidDateValue);
    if (Number.isNaN(paidAt.getTime())) {
      return res.status(422).json({ message: "Enter a valid paid date" });
    }

    const record = await prisma.operationalRecord.update({
      where: { id: existing.id },
      data: {
        status: "PENDING_APPROVAL",
        payload: {
          ...existingPayload,
          billState: "PAYMENT_REPORTED",
          reportedPaidAt: paidAt.toISOString(),
          reportedPaidDate: paidAt.toISOString().slice(0, 10),
          reportedPaidBy: req.user.id,
          reportedPaidByName: req.user.name,
          paymentDeniedNote: "",
          paymentDeniedAt: ""
        }
      },
      include: { branch: true, createdBy: { select: { id: true, name: true, email: true, role: { select: { name: true } } } } }
    });

    await writeAudit({
      req,
      action: "OPERATION_UPDATED",
      entityType: "OperationalRecord",
      entityId: record.id,
      metadata: { category: record.category, status: record.status, event: "resident_reported_bill_payment" }
    });

    const adminIds = await getCompanyUserIdsByRoles({ companyId: record.companyId, roles: ["SOCIETY_ADMIN", "COMPANY_ADMIN", "SUPER_ADMIN"] });
    await runOperationSideEffect("bill payment update notification", async () => {
      await createBulkInAppNotifications({
        companyId: record.companyId,
        userIds: adminIds.filter((id) => id !== req.user.id),
        title: `Payment verification needed: ${record.payload?.flatNumber || record.payload?.target?.flatNumber || record.title}`,
        body: `${req.user.name || "Resident"} reported payment on ${paidAt.toLocaleDateString()}.`,
        data: { operationId: record.id, category: record.category, status: record.status, event: "bill_payment_reported" }
      });
    });

    res.json({ record });
    return;
  }

  const nextStatus = req.validated.body.status;
  if (req.user.role.name === "FLAT_OWNER" && isVotingCategory(existing.category)) {
    if (Object.keys(req.validated.body).some((key) => key !== "payload")) {
      return res.status(403).json({ message: "Residents can only cast votes on polls" });
    }
    if (existing.status !== "OPEN") {
      return res.status(409).json({ message: "This poll is closed" });
    }

    const existingPayload = parseJsonObject(existing.payload);
    const votingEndsAt = existing.dueAt || existingPayload.endsAt;
    if (votingEndsAt) {
      const parsedEndsAt = new Date(votingEndsAt);
      if (!Number.isNaN(parsedEndsAt.getTime()) && parsedEndsAt.getTime() < Date.now()) {
        return res.status(409).json({ message: "Voting limit has ended" });
      }
    }

    const requestedPayload = parseJsonObject(req.validated.body.payload);
    const options = Array.isArray(existingPayload.options) ? existingPayload.options : [];
    const currentVotes = existingPayload.votes && typeof existingPayload.votes === "object" ? existingPayload.votes : {};
    const requestedVotes = requestedPayload.votes && typeof requestedPayload.votes === "object" ? requestedPayload.votes : {};
    const votedBy = Array.isArray(existingPayload.votedBy) ? existingPayload.votedBy : [];

    if (votedBy.includes(req.user.id)) {
      return res.status(409).json({ message: "You have already voted in this poll" });
    }

    const selectedOption =
      String(requestedPayload.selectedOption || "").trim() ||
      inferSelectedVotingOption({ requestedVotes, currentVotes, options });

    if (!selectedOption || !options.includes(selectedOption)) {
      return res.status(422).json({ message: "Select a valid poll option" });
    }

    const record = await prisma.operationalRecord.update({
      where: { id: existing.id },
      data: {
        payload: {
          ...existingPayload,
          votes: {
            ...currentVotes,
            [selectedOption]: Number(currentVotes[selectedOption] || 0) + 1
          },
          votedBy: [...new Set([...votedBy, req.user.id])],
          lastVoteAt: new Date().toISOString(),
          lastVoteBy: req.user.id
        }
      },
      include: { branch: true, createdBy: { select: { id: true, name: true, email: true, role: { select: { name: true } } } } }
    });

    await writeAudit({
      req,
      action: "OPERATION_UPDATED",
      entityType: "OperationalRecord",
      entityId: record.id,
      metadata: { category: record.category, status: record.status, event: "vote_cast" }
    });

    res.json({ record: redactResidentVotingRecord(record, req.user.id) });
    return;
  }

  const existingPayloadForAmenity = parseJsonObject(existing.payload);
  const isExistingAmenityBooking = isAmenityBookingRecord(existing);
  if (isExistingAmenityBooking && ["APPROVED", "REJECTED"].includes(nextStatus || "") && !isSocietyAdmin(req)) {
    return res.status(403).json({ message: "Only society admins can approve or reject amenity bookings" });
  }

  if (isExistingAmenityBooking && nextStatus === "APPROVED") {
    const sourcePayload = req.validated.body.payload ? parseJsonObject(req.validated.body.payload) : existingPayloadForAmenity;
    const { amenity, date, slot } = extractAmenitySlot(sourcePayload);
    if (!amenity || !date || !slot) {
      return res.status(422).json({ message: "Amenity booking payload is incomplete for approval" });
    }
    const conflict = await findApprovedAmenityBooking({
      companyId: existing.companyId,
      amenity,
      date,
      slot,
      excludeId: existing.id
    });
    if (conflict) {
      return res.status(409).json({ message: "This amenity slot is already approved for another booking" });
    }
  }

  const updateBody = {
    ...req.validated.body,
    ...(req.validated.body.payload ? { payload: await persistOperationPayloadImages(req, parseJsonObject(req.validated.body.payload)) } : {})
  };

  const record = await prisma.operationalRecord.update({
    where: { id: existing.id },
    data: {
      ...updateBody,
      resolvedAt: ["RESOLVED", "CLOSED", "APPROVED", "REJECTED"].includes(nextStatus) ? new Date() : undefined
    },
    include: { branch: true, createdBy: { select: { id: true, name: true, email: true, role: { select: { name: true } } } } }
  });

  await writeAudit({
    req,
    action: "OPERATION_UPDATED",
    entityType: "OperationalRecord",
    entityId: record.id,
    metadata: { category: record.category, status: record.status }
  });

  const notifyUserIds = [record.createdById, record.assignedToId].filter((id) => id && id !== req.user.id);
  await runOperationSideEffect("operation update notification", async () => {
    await createBulkInAppNotifications({
      companyId: record.companyId,
      userIds: notifyUserIds,
      title: `${record.category} update: ${record.title}`,
      body: `Status: ${record.status}${record.description ? ` - ${record.description}` : ""}`,
      data: { operationId: record.id, category: record.category, status: record.status, event: "updated" }
    });
  });

  if ((isComplaintCategory(record.category) || isMaintenanceCategory(record.category)) && record.payload) {
    const targetAudience = await getTargetedFlatAudience({ companyId: record.companyId, payload: record.payload || {} });
    const alreadyNotified = new Set([...notifyUserIds, req.user.id].filter(Boolean));
    await createBulkInAppNotifications({
      companyId: record.companyId,
      userIds: targetAudience.userIds.filter((id) => !alreadyNotified.has(id)),
      title: `${record.category} update: ${record.title}`,
      body: `Status: ${record.status}${record.description ? ` - ${record.description}` : ""}`,
      data: {
        operationId: record.id,
        category: record.category,
        status: record.status,
        event: "unit_request_updated",
        flatIds: targetAudience.flatIds
      }
    });
  }

  if (isMaintenanceBillingCategory(record.category) && isSocietyAdmin(req)) {
    const targetAudience = await getTargetedFlatAudience({ companyId: record.companyId, payload: record.payload || {} });
    const billState = String(record.payload?.billState || "").toUpperCase();
    const denied = billState === "UNPAID" && record.payload?.paymentDeniedNote;
    const confirmed = billState === "PAID" || record.status === "RESOLVED";
    if (targetAudience.userIds.length > 0 && (denied || confirmed)) {
      await createBulkInAppNotifications({
        companyId: record.companyId,
        userIds: targetAudience.userIds.filter((id) => id !== req.user.id),
        title: denied ? "Maintenance payment denied" : "Maintenance payment confirmed",
        body: denied ? record.payload.paymentDeniedNote : "Admin confirmed your maintenance payment.",
        data: {
          operationId: record.id,
          category: record.category,
          status: record.status,
          event: denied ? "bill_payment_denied" : "bill_payment_confirmed"
        }
      });
    }
  }

  if (isAnnouncementCategory(record.category)) {
    const residents = await getCompanyUserIdsByRoles({ companyId: record.companyId, roles: announcementAudienceRoles });
    await createBulkInAppNotifications({
      companyId: record.companyId,
      userIds: residents.filter((id) => id !== req.user.id),
      title: `Announcement updated: ${record.title}`,
      body: record.description || "A society announcement was updated.",
      data: { operationId: record.id, category: record.category, status: record.status, event: "announcement_updated" }
    });
  }

  if (isDirectoryCategory(record.category)) {
    const residents = await getCompanyUserIdsByRoles({ companyId: record.companyId });
    await createBulkInAppNotifications({
      companyId: record.companyId,
      userIds: residents.filter((id) => id !== req.user.id),
      title: `Directory updated: ${record.title}`,
      body: record.description || "Society contact directory has been updated.",
      data: { operationId: record.id, category: record.category, status: record.status, event: "directory_updated" }
    });
  }

  res.json({ record });
});
