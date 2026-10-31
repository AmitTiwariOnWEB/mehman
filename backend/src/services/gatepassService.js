import QRCode from "qrcode";
import crypto from "node:crypto";
import dayjs from "dayjs";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { sha256, signPayload, verifySignedPayload } from "../utils/crypto.js";

const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const isTwentyFourHourGatepass = (gatepass) => {
  const metadata = asObject(gatepass?.metadata);
  const passType = String(metadata.passType || "").toUpperCase();
  const validityHours = Number(metadata.validityHours || metadata.durationHours || 0);
  const duration = String(metadata.duration || "").toLowerCase();

  return passType === "TEMPORARY" || validityHours === 24 || duration === "24h";
};

export const createGatepassForVisitor = async ({ visitor, validUntil, approvedById, vehicleId, status = "ACTIVE", metadata = {} }) => {
  const passCode = `MEHMAN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const payload = {
    gatepassId: crypto.randomUUID(),
    passCode,
    companyId: visitor.companyId,
    branchId: visitor.branchId,
    visitor: {
      id: visitor.id,
      name: visitor.fullName,
      phone: visitor.phone
    },
    passType: metadata.passType,
    flat: metadata.flatNumber,
    exp: dayjs(validUntil).unix()
  };
  const token = signPayload(payload, env.QR_SIGNING_SECRET);
  const qrPayload = { ...payload, token };
  const qrImageDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#061827", light: "#ffffff" }
  });

  return prisma.gatepass.create({
    data: {
      id: payload.gatepassId,
      companyId: visitor.companyId,
      branchId: visitor.branchId,
      visitorId: visitor.id,
      vehicleId,
      approvedById,
      passCode,
      qrTokenHash: sha256(token),
      qrPayload,
      qrImageDataUrl,
      status,
      metadata,
      validUntil
    },
    include: { visitor: true, vehicle: true, branch: true, entryLogs: true }
  });
};

export const validateQrScan = async ({ qrPayload, guard, action = "AUTO", deviceId, branchId }) => {
  const payload = typeof qrPayload === "string" ? JSON.parse(qrPayload) : qrPayload;
  const verified = verifySignedPayload(payload.token, env.QR_SIGNING_SECRET);

  if (!verified || verified.gatepassId !== payload.gatepassId) {
    throw Object.assign(new Error("Invalid QR signature"), { statusCode: 400 });
  }

  const gatepass = await prisma.gatepass.findUnique({
    where: { id: verified.gatepassId },
    include: { visitor: true, branch: true }
  });

  if (!gatepass || gatepass.companyId !== guard.companyId) {
    throw Object.assign(new Error("Gatepass not found for this company"), { statusCode: 404 });
  }

  if (branchId && gatepass.branchId !== branchId) {
    throw Object.assign(new Error(`Gatepass is valid only for ${gatepass.branch?.name || "the assigned gate"}`), { statusCode: 409 });
  }

  if (guard.role.name !== "SOCIETY_ADMIN") {
    if (guard.branchId && gatepass.branchId !== guard.branchId) {
      throw Object.assign(new Error("Gatepass belongs to another branch"), { statusCode: 403 });
    }
    if (guard.branchId && branchId && branchId !== guard.branchId) {
      throw Object.assign(new Error("You can scan only for your assigned gate"), { statusCode: 403 });
    }
  }

  if (gatepass.validUntil < new Date()) {
    throw Object.assign(new Error("Gatepass expired"), { statusCode: 409 });
  }

  if (gatepass.status === "BLACKLISTED" || gatepass.visitor.isBlacklisted) {
    throw Object.assign(new Error("Visitor is blacklisted"), { statusCode: 409 });
  }

  if (["DRAFT", "CANCELLED", "EXPIRED"].includes(gatepass.status)) {
    throw Object.assign(new Error(`Gatepass is ${gatepass.status.toLowerCase()}`), { statusCode: 409 });
  }

  const effectiveAction =
    action === "AUTO"
      ? !gatepass.checkedInAt
        ? "ENTRY"
        : !gatepass.checkedOutAt
          ? "EXIT"
          : "COMPLETED"
      : action;

  if (effectiveAction === "COMPLETED") {
    throw Object.assign(new Error("Gatepass already checked out"), { statusCode: 409 });
  }

  if (effectiveAction === "ENTRY" && gatepass.checkedInAt && !gatepass.checkedOutAt) {
    throw Object.assign(new Error("Gatepass is already checked in. Use AUTO or EXIT to check out."), { statusCode: 409 });
  }

  if (effectiveAction === "ENTRY" && gatepass.entryCount >= gatepass.maxEntries) {
    const message = gatepass.checkedOutAt
      ? "Gatepass has already been used and cannot be used again"
      : "Gatepass entry limit reached";
    throw Object.assign(new Error(message), { statusCode: 409 });
  }

  if (effectiveAction === "EXIT" && !gatepass.checkedInAt) {
    throw Object.assign(new Error("Cannot exit before entry is logged"), { statusCode: 409 });
  }

  return prisma.$transaction(async (tx) => {
    const scanGateId = branchId || guard.branchId || gatepass.branchId;
    const scanGate = await tx.branch.findFirst({
      where: { id: scanGateId, companyId: gatepass.companyId },
      select: { id: true, name: true }
    });
    const scanGateName = scanGate?.name || gatepass.branch?.name || "Assigned Gate";

    const log = await tx.entryLog.create({
      data: {
        companyId: gatepass.companyId,
        branchId: scanGate?.id || gatepass.branchId,
        gatepassId: gatepass.id,
        loggedById: guard.id,
        action: effectiveAction,
        deviceId,
        snapshot: {
          visitorName: gatepass.visitor.fullName,
          passCode: gatepass.passCode,
          scanGateId: scanGate?.id || gatepass.branchId,
          scanGateName
        }
      }
    });

    let update =
      effectiveAction === "ENTRY"
        ? { status: "CHECKED_IN", checkedInAt: new Date(), entryCount: { increment: 1 } }
        : effectiveAction === "EXIT"
          ? { status: "CHECKED_OUT", checkedOutAt: new Date() }
          : { status: "ACTIVE" };

    const shouldStartTwentyFourHourValidity =
      effectiveAction === "ENTRY" && !gatepass.checkedInAt && isTwentyFourHourGatepass(gatepass);

    if (shouldStartTwentyFourHourValidity) {
      const scannedAt = new Date();
      const autoCheckoutAt = dayjs(scannedAt).add(24, "hour").toDate();
      update = {
        ...update,
        checkedInAt: scannedAt,
        validUntil: autoCheckoutAt,
        metadata: {
          ...asObject(gatepass.metadata),
          firstScannedAt: scannedAt.toISOString(),
          autoCheckoutAt: autoCheckoutAt.toISOString(),
          validityHours: 24
        }
      };
    }

    const updatedGatepass = await tx.gatepass.update({
      where: { id: gatepass.id },
      data: update,
      include: { visitor: true, branch: true, vehicle: true, entryLogs: { orderBy: { occurredAt: "desc" }, take: 3 } }
    });

    const notifyUserIds = [
      updatedGatepass.metadata?.targetOwnerId,
      updatedGatepass.metadata?.targetOwner2Id,
      updatedGatepass.approvedById
    ].filter(Boolean);
    const uniqueNotifyUserIds = [...new Set(notifyUserIds)];
    if (uniqueNotifyUserIds.length > 0) {
      await tx.notification.createMany({
        data: uniqueNotifyUserIds.map((userId) => ({
          companyId: updatedGatepass.companyId,
          userId,
          title: effectiveAction === "ENTRY" ? "Visitor checked in" : effectiveAction === "EXIT" ? "Visitor checked out" : "Gatepass denied",
          body: `${updatedGatepass.visitor.fullName} ${effectiveAction.toLowerCase()} at ${scanGateName}`,
          status: "SENT",
          channel: "IN_APP",
          data: {
            gatepassId: updatedGatepass.id,
            visitorId: updatedGatepass.visitorId,
            action: effectiveAction,
            gateId: scanGate?.id || gatepass.branchId,
            gateName: scanGateName
          }
        }))
      });
    }

    return { gatepass: updatedGatepass, entryLog: log };
  });
};
