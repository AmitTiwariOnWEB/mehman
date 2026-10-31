import { z } from "zod";
import QRCode from "qrcode";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateQrScan } from "../services/gatepassService.js";
import { writeAudit } from "../services/auditService.js";
import { createInAppNotification } from "../services/notificationService.js";

export const scanSchema = z.object({
  body: z.object({
    qrPayload: z.union([z.string(), z.record(z.any())]),
    action: z.enum(["AUTO", "ENTRY", "EXIT", "DENIED"]).default("AUTO"),
    deviceId: z.string().optional(),
    branchId: z.string().uuid().optional()
  })
});

export const updateGatepassStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(["ACTIVE", "CANCELLED", "CHECKED_IN", "CHECKED_OUT"])
  })
});

const getApprovalActorLabel = (user) => {
  if (user?.role?.name === "FLAT_OWNER") {
    return user.company?.settings?.clientType === "CORPORATE" ? "office" : "resident";
  }
  if (user?.role?.name === "SOCIETY_ADMIN") {
    return user.company?.settings?.clientType === "CORPORATE" ? "corporate office" : "society admin";
  }
  if (user?.role?.name === "SECURITY_GUARD") return "security";
  return "office";
};

export const getGatepass = asyncHandler(async (req, res) => {
  const gatepass = await prisma.gatepass.findFirst({
    where: {
      id: req.params.id,
      ...(req.tenant.isSuperAdmin ? {} : { companyId: req.user.companyId })
    },
    include: { visitor: true, vehicle: true, branch: true, entryLogs: true }
  });

  if (!gatepass) return res.status(404).json({ message: "Gatepass not found" });
  res.json({ gatepass });
});

const qrImageToBuffer = async (gatepass) => {
  const inlineImage = String(gatepass?.qrImageDataUrl || "").trim();
  const imageSource = inlineImage || await QRCode.toDataURL(
    typeof gatepass?.qrPayload === "string" ? gatepass.qrPayload : JSON.stringify(gatepass?.qrPayload || gatepass?.passCode || ""),
    {
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#061827", light: "#ffffff" }
    }
  );
  const base64 = imageSource.includes(",") ? imageSource.split(",").pop() : imageSource;
  return Buffer.from(String(base64 || ""), "base64");
};

export const getGatepassQrImage = asyncHandler(async (req, res) => {
  const gatepass = await prisma.gatepass.findUnique({
    where: { id: req.params.id },
    select: { id: true, passCode: true, qrPayload: true, qrImageDataUrl: true }
  });

  if (!gatepass) return res.status(404).json({ message: "Gatepass QR not found" });

  const buffer = await qrImageToBuffer(gatepass);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.send(buffer);
});

export const updateGatepassStatus = asyncHandler(async (req, res) => {
  const nextStatus = req.validated.body.status;
  const gatepass = await prisma.gatepass.findFirst({
    where: {
      id: req.validated.params.id,
      ...(req.tenant.isSuperAdmin ? {} : { companyId: req.user.companyId })
    },
    include: { visitor: true, vehicle: true, branch: true }
  });

  if (!gatepass) return res.status(404).json({ message: "Gatepass not found" });
  const isMovementStatus = ["CHECKED_IN", "CHECKED_OUT"].includes(nextStatus);

  if (!isMovementStatus && gatepass.status !== "DRAFT") {
    return res.status(409).json({ message: "Gatepass decision is final and cannot be changed" });
  }

  if (isMovementStatus) {
    if (!["SECURITY_GUARD", "SOCIETY_ADMIN", "SUPER_ADMIN"].includes(req.user.role.name)) {
      return res.status(403).json({ message: "Only security or admin can mark visitor movement" });
    }
    if (nextStatus === "CHECKED_IN" && gatepass.status !== "ACTIVE") {
      return res.status(409).json({ message: "Only active gatepasses can be checked in" });
    }
    if (nextStatus === "CHECKED_OUT" && gatepass.status !== "CHECKED_IN") {
      return res.status(409).json({ message: "Only checked-in gatepasses can be checked out" });
    }

    const action = nextStatus === "CHECKED_IN" ? "ENTRY" : "EXIT";
    const scanGateId = req.user.branchId || gatepass.branchId;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.entryLog.create({
        data: {
          companyId: gatepass.companyId,
          branchId: scanGateId,
          gatepassId: gatepass.id,
          loggedById: req.user.id,
          action,
          snapshot: {
            visitorName: gatepass.visitor.fullName,
            passCode: gatepass.passCode,
            markedFrom: "guard_queue"
          }
        }
      });

      return tx.gatepass.update({
        where: { id: gatepass.id },
        data: nextStatus === "CHECKED_IN"
          ? { status: "CHECKED_IN", checkedInAt: new Date(), entryCount: { increment: 1 } }
          : { status: "CHECKED_OUT", checkedOutAt: new Date() },
        include: { visitor: true, vehicle: true, branch: true }
      });
    });

    await writeAudit({
      req,
      action: `GATEPASS_${nextStatus}`,
      entityType: "Gatepass",
      entityId: updated.id
    });

    const notifyUserIds = [
      updated.metadata?.targetOwnerId,
      updated.metadata?.targetOwner2Id,
      updated.approvedById
    ].filter((id) => id && id !== req.user.id);

    await Promise.all([...new Set(notifyUserIds)].map((userId) =>
      createInAppNotification({
        companyId: updated.companyId,
        userId,
        title: nextStatus === "CHECKED_IN" ? "Visitor checked in" : "Visitor checked out",
        body: `${updated.visitor.fullName} ${nextStatus === "CHECKED_IN" ? "entered" : "exited"} at ${updated.branch?.name || "the gate"}`,
        data: { gatepassId: updated.id, visitorId: updated.visitorId, status: updated.status }
      })
    ));

    res.json({ gatepass: updated });
    return;
  }

  const updated = await prisma.gatepass.update({
    where: { id: gatepass.id },
    data: {
      status: nextStatus,
      approvedById: nextStatus === "ACTIVE" ? req.user.id : null
    },
    include: { visitor: true, vehicle: true, branch: true }
  });

  await writeAudit({
    req,
    action: `GATEPASS_${nextStatus}`,
    entityType: "Gatepass",
    entityId: updated.id
  });

  if (gatepass.visitor?.createdById && gatepass.visitor.createdById !== req.user.id) {
    const actorLabel = getApprovalActorLabel(req.user);
    await createInAppNotification({
      companyId: updated.companyId,
      userId: gatepass.visitor.createdById,
      title: nextStatus === "ACTIVE" ? "Visitor approved" : "Visitor rejected",
      body: `${gatepass.visitor.fullName} was ${nextStatus === "ACTIVE" ? "approved" : "rejected"} by ${actorLabel}`,
      data: { gatepassId: updated.id, visitorId: updated.visitorId, status: updated.status }
    });
  }

  res.json({ gatepass: updated });
});

export const getEntryLogs = asyncHandler(async (req, res) => {
  const companyFilter = req.tenant.isSuperAdmin ? {} : { companyId: req.user.companyId };
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 86400000);
  const to = req.query.to ? new Date(req.query.to + "T23:59:59.999Z") : new Date();
  const limit = Math.min(Number(req.query.limit) || 2000, 5000);

  const logs = await prisma.entryLog.findMany({
    where: {
      ...companyFilter,
      occurredAt: { gte: from, lte: to }
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
    include: {
      gatepass: { include: { visitor: true, vehicle: true } },
      branch: { select: { name: true } },
      loggedBy: { select: { name: true, role: { select: { name: true } } } }
    }
  });

  res.json({ logs });
});

export const scanGatepass = asyncHandler(async (req, res) => {
  const result = await validateQrScan({
    qrPayload: req.validated.body.qrPayload,
    guard: req.user,
    action: req.validated.body.action,
    deviceId: req.validated.body.deviceId,
    branchId: req.validated.body.branchId
  });

  await writeAudit({
    req,
    action: `GATEPASS_${result.entryLog.action}`,
    entityType: "Gatepass",
    entityId: result.gatepass.id
  });

  res.json(result);
});
