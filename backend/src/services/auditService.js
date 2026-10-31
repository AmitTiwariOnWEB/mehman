import { prisma } from "../config/prisma.js";

export const writeAudit = ({ req, action, entityType, entityId, metadata = {} }) =>
  prisma.auditLog.create({
    data: {
      companyId: req.user?.companyId,
      actorId: req.user?.id,
      action,
      entityType,
      entityId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata
    }
  });
