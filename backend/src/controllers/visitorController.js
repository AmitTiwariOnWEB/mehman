import { z } from "zod";
import dayjs from "dayjs";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createGatepassForVisitor } from "../services/gatepassService.js";
import { writeAudit } from "../services/auditService.js";
import { createInAppNotification } from "../services/notificationService.js";

const imageSourceSchema = z.string().max(6000000).refine(
  (value) => value.startsWith("data:image/") || z.string().url().safeParse(value).success,
  "Photo must be a valid uploaded or captured image"
);
const indianMobileSchema = z.string().regex(/^\d{10}$/, "Mobile number must be exactly 10 digits");
const optionalMobileSchema = z.string().trim().optional().default("");
const vehicleNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/, "Vehicle number must be in format MH03AL5423");
const VISITOR_PHOTO_COLUMN_SAFE_LENGTH = 180;
const DATA_IMAGE_PATTERN = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/i;

const getRequestOrigin = (req) => `${req.protocol}://${req.get("host")}`;

const persistDataImage = async ({ req, value, folder = "visitor-photos" }) => {
  const raw = String(value || "").trim();
  const match = raw.match(DATA_IMAGE_PATTERN);
  if (!match) return raw || null;

  const extension = match[1].toLowerCase().replace("jpeg", "jpg");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length) return null;

  const uploadRoot = path.resolve(process.cwd(), "uploads", folder);
  await fs.mkdir(uploadRoot, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  await fs.writeFile(path.join(uploadRoot, filename), buffer);
  return `${getRequestOrigin(req)}/uploads/${folder}/${filename}`;
};

export const createVisitorSchema = z.object({
  body: z.object({
    branchId: z.string().uuid().optional(),
    flatId: z.string().uuid().optional(),
    passType: z.enum(["VISITOR", "GUEST", "DELIVERY", "PARCEL", "VEHICLE", "TEMPORARY"]).default("VISITOR"),
    fullName: z.string().min(2),
    phone: optionalMobileSchema,
    email: z.string().email().optional(),
    organization: z.string().optional(),
    purpose: z.string().min(3),
    photoUrl: imageSourceSchema.optional(),
    idType: z.string().max(60).optional(),
    idNumber: z.string().max(120).optional(),
    idPhotoUrl: imageSourceSchema.optional(),
    vehicle: z
      .object({
        number: vehicleNumberSchema,
        type: z.string().optional(),
        color: z.string().optional()
      })
      .optional(),
    validUntil: z.coerce.date().optional()
  }).superRefine((body, ctx) => {
    if (body.passType === "VEHICLE" && !body.vehicle?.number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vehicle", "number"],
        message: "Vehicle number is required for vehicle pass"
      });
    }
    if (!["DELIVERY", "PARCEL"].includes(body.passType) && !indianMobileSchema.safeParse(body.phone).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Mobile number must be exactly 10 digits"
      });
    }
  })
});

const scopedWhere = (req) => (req.tenant.isSuperAdmin ? {} : { companyId: req.tenant.companyId });

const withDisplayPhoto = (visitor) => {
  const pass = visitor.gatepasses?.[0];
  const metadata = pass?.metadata && typeof pass.metadata === "object" ? pass.metadata : {};
  const photoUrl =
    visitor.photoUrl ||
    metadata.visitorPhotoUrl ||
    metadata.visitorImageUrl ||
    metadata.visitorPhoto ||
    metadata.photoUrl ||
    metadata.imageUrl ||
    null;

  return {
    ...visitor,
    photoUrl,
    imageUrl: photoUrl
  };
};

export const listVisitors = asyncHandler(async (req, res) => {
  const createdAt = {};
  if (req.query.from) createdAt.gte = new Date(String(req.query.from));
  if (req.query.to) createdAt.lte = new Date(`${String(req.query.to).slice(0, 10)}T23:59:59.999Z`);
  const hasCreatedAtFilter = Object.keys(createdAt).length > 0;
  const limit = Math.min(Number(req.query.limit) || 100, 5000);

  const visitors = await prisma.visitor.findMany({
    where: {
      ...scopedWhere(req),
      ...(req.query.branchId ? { branchId: String(req.query.branchId) } : {}),
      ...(hasCreatedAtFilter ? { createdAt } : {})
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      branch: true,
      gatepasses: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { branch: true, vehicle: true, entryLogs: { orderBy: { occurredAt: "desc" }, take: 4 } }
      },
      vehicles: true,
      createdBy: { select: { id: true, name: true, email: true, role: { select: { name: true } } } }
    }
  });

  const scopedVisitors =
    req.user.role.name === "FLAT_OWNER"
      ? visitors.filter((visitor) => {
          const pass = visitor.gatepasses?.[0];
          return (
            visitor.createdById === req.user.id ||
            pass?.metadata?.targetOwnerId === req.user.id ||
            pass?.metadata?.targetOwner2Id === req.user.id
          );
        })
      : visitors;

  res.json({ visitors: scopedVisitors.slice(0, limit).map(withDisplayPhoto) });
});

export const createVisitor = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  let branchId = req.validated.body.branchId || req.user.branchId;
  let selectedGate = null;

  /* Flat owners don't have a branchId on their account.
     Resolve it: flat's branch → any active branch for the society */
  if (!branchId && req.user.role.name === "FLAT_OWNER") {
    const ownerFlat = await prisma.flat.findFirst({
      where: {
        companyId,
        OR: [{ ownerId: req.user.id }, { owner2Id: req.user.id }],
        branchId: { not: null }
      }
    });
    branchId = ownerFlat?.branchId ?? null;

    if (!branchId) {
      const anyBranch = await prisma.branch.findFirst({
        where: { companyId, isActive: true },
        orderBy: { createdAt: "asc" }
      });
      branchId = anyBranch?.id ?? null;
    }
  }

  if (!companyId || !branchId) {
    return res.status(400).json({ message: "Company and branch context are required" });
  }

  selectedGate = await prisma.branch.findFirst({
    where: { id: branchId, companyId, isActive: true },
    select: { id: true, name: true }
  });
  if (!selectedGate) {
    return res.status(404).json({ message: "Selected gate was not found" });
  }

  const { vehicle, validUntil, flatId, passType, idNumber, idPhotoUrl, ...visitorData } = req.validated.body;
  const rawVisitorPhotoUrl = String(visitorData.photoUrl || "").trim();
  const persistedVisitorPhotoUrl = await persistDataImage({ req, value: rawVisitorPhotoUrl });
  const persistedIdPhotoUrl = await persistDataImage({ req, value: idPhotoUrl, folder: "guest-id-photos" });
  const isEmbeddedPhoto = String(persistedVisitorPhotoUrl || "").startsWith("data:image/");
  const visitorPhotoForRecord =
    persistedVisitorPhotoUrl && !isEmbeddedPhoto && persistedVisitorPhotoUrl.length <= VISITOR_PHOTO_COLUMN_SAFE_LENGTH
      ? persistedVisitorPhotoUrl
      : null;
  const visitorPhotoForGatepass = persistedVisitorPhotoUrl || null;
  const { photoUrl: _ignoredPhotoUrl, ...visitorDataWithoutPhoto } = visitorData;
  const normalizedIdNumber = String(idNumber || "").trim().toUpperCase();
  const idNumberHash = normalizedIdNumber
    ? createHash("sha256").update(normalizedIdNumber).digest("hex")
    : null;

  if (validUntil && dayjs(validUntil).isBefore(dayjs())) {
    return res.status(422).json({ message: "Pass validity must be in the future" });
  }

  /* Look up the flat — check both owner slots for FLAT_OWNER */
  const targetFlat = flatId
    ? await prisma.flat.findFirst({
        where: { id: flatId, companyId },
        include: { owner: true, owner2: true }
      })
    : req.user.role.name === "FLAT_OWNER"
      ? await prisma.flat.findFirst({
          where: {
            companyId,
            isActive: true,
            OR: [{ ownerId: req.user.id }, { owner2Id: req.user.id }]
          },
          include: { owner: true, owner2: true }
        })
      : null;

  if (flatId && !targetFlat) {
    return res.status(404).json({ message: "Selected flat was not found" });
  }

  if (req.user.role.name === "SECURITY_GUARD" && !targetFlat?.ownerId && !targetFlat?.owner2Id) {
    return res.status(422).json({ message: "Select a flat with an assigned owner before sending approval" });
  }

  const result = await prisma.$transaction(async (tx) => {
    const visitor = await tx.visitor.create({
      data: {
        ...visitorDataWithoutPhoto,
        photoUrl: visitorPhotoForRecord,
        companyId,
        branchId,
        createdById: req.user.id,
        idNumberHash
      }
    });

    let vehicleRecord = null;
    if (vehicle) {
      vehicleRecord = await tx.vehicle.upsert({
        where: { companyId_number: { companyId, number: vehicle.number.toUpperCase() } },
        create: { ...vehicle, number: vehicle.number.toUpperCase(), companyId, visitorId: visitor.id },
        update: { visitorId: visitor.id, type: vehicle.type, color: vehicle.color }
      });
    }

    return { visitor, vehicle: vehicleRecord };
  });

  const createdByGuard = req.user.role.name === "SECURITY_GUARD";
  const fallbackValidity =
    validUntil || (passType === "TEMPORARY" ? dayjs().add(30, "day").toDate() : dayjs().add(1, "day").toDate());

  const gatepass = await createGatepassForVisitor({
    visitor: result.visitor,
    vehicleId: result.vehicle?.id,
    approvedById: createdByGuard ? null : req.user.id,
    status: createdByGuard ? "DRAFT" : "ACTIVE",
    metadata: {
      passType,
      sourceRole: req.user.role.name,
      targetFlatId: targetFlat?.id,
      targetOwnerId: targetFlat?.ownerId,
      targetOwner2Id: targetFlat?.owner2Id,
      flatNumber: targetFlat?.flatNumber,
      tower: targetFlat?.tower,
      floor: targetFlat?.floor,
      gateId: selectedGate.id,
      gateName: selectedGate.name,
      vehicleNumber: vehicle?.number || null,
      visitorPhotoUrl: visitorPhotoForGatepass,
      hasVisitorPhoto: Boolean(visitorPhotoForGatepass),
      guestIdType: visitorDataWithoutPhoto.idType || null,
      hasGuestIdNumber: Boolean(idNumberHash),
      guestIdCardImage: persistedIdPhotoUrl || null
    },
    validUntil: fallbackValidity
  });

  if (createdByGuard && targetFlat) {
    /* Notify both owners (slots 1 and 2) if present */
    const ownerIds = [targetFlat.ownerId, targetFlat.owner2Id].filter(Boolean);
    await Promise.all(ownerIds.map((userId) =>
      createInAppNotification({
        companyId,
        userId,
        title: "Visitor approval requested",
        body: `${result.visitor.fullName} is waiting at ${selectedGate.name} for ${targetFlat.flatNumber}`,
        data: { visitorId: result.visitor.id, gatepassId: gatepass.id, flatId: targetFlat.id, passType, gateId: selectedGate.id, gateName: selectedGate.name }
      })
    ));
  } else if (!createdByGuard) {
    const guards = await prisma.guard.findMany({
      where: { companyId, branchId: selectedGate.id, isOnDuty: true },
      include: { user: true }
    });
    await Promise.all(
      guards.map((guard) =>
        createInAppNotification({
          companyId,
          userId: guard.userId,
          title: "Pre-approved QR pass created",
          body: `${result.visitor.fullName} has an active ${passType.toLowerCase()} pass for ${targetFlat?.flatNumber || "resident"} via ${selectedGate.name}`,
          data: { visitorId: result.visitor.id, gatepassId: gatepass.id, passType, gateId: selectedGate.id, gateName: selectedGate.name }
        })
      )
    );
  }

  await writeAudit({
    req,
    action: "VISITOR_CREATED",
    entityType: "Visitor",
    entityId: result.visitor.id,
    metadata: { gatepassId: gatepass.id }
  });

  res.status(201).json({ visitor: result.visitor, gatepass });
});
