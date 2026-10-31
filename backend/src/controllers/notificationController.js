import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createInAppNotification } from "../services/notificationService.js";
import { z } from "zod";

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

const redactNotificationOperation = (operation, req) => {
  if (!operation) return null;
  const payload = parseJsonObject(operation.payload);
  const isVoting = String(operation.category || "").toLowerCase().includes("voting");
  const isResident = req.user.role.name === "FLAT_OWNER";
  return {
    ...operation,
    payload:
      isResident && isVoting
        ? {
            ...payload,
            votes: {},
            votedBy: Array.isArray(payload.votedBy) && payload.votedBy.includes(req.user.id) ? [req.user.id] : [],
            hasVoted: Array.isArray(payload.votedBy) && payload.votedBy.includes(req.user.id)
          }
        : payload
  };
};

export const registerPushTokenSchema = z.object({
  body: z.object({
    token: z.string().min(20).max(260),
    platform: z.string().max(30).optional(),
    deviceId: z.string().max(120).optional()
  })
});

export const unregisterPushTokenSchema = z.object({
  body: z
    .object({
      token: z.string().min(20).max(260).optional(),
      deviceId: z.string().max(120).optional()
    })
    .refine((body) => Boolean(body.token || body.deviceId), {
      message: "Provide token or deviceId to unregister push token"
    })
});

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: {
      companyId: req.user.companyId,
      userId: req.user.id
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(req.query.limit) || 30, 100)
  });

  const notificationData = notifications.map((notification) => parseJsonObject(notification.data));
  const operationIds = [
    ...new Set(notificationData.map((data) => (data.operationId ? String(data.operationId) : "")).filter(Boolean))
  ];
  const operations =
    operationIds.length > 0
      ? await prisma.operationalRecord.findMany({
          where: { companyId: req.user.companyId, id: { in: operationIds } },
          select: {
            id: true,
            category: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            payload: true,
            dueAt: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : [];
  const operationMap = new Map(operations.map((operation) => [operation.id, redactNotificationOperation(operation, req)]));

  res.json({
    notifications: notifications.map((notification, index) => {
      const data = notificationData[index] || {};
      return {
        ...notification,
        data,
        operation: data.operationId ? operationMap.get(String(data.operationId)) || null : null
      };
    })
  });
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: {
      companyId: req.user.companyId,
      userId: req.user.id,
      readAt: null
    },
    data: { readAt: new Date(), status: "READ" }
  });

  res.status(204).send();
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: req.params.id,
      companyId: req.user.companyId,
      userId: req.user.id
    }
  });

  if (!notification) return res.status(404).json({ message: "Notification not found" });

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt || new Date(), status: "READ" }
  });

  res.json({ notification: updated });
});

export const registerPushToken = asyncHandler(async (req, res) => {
  const { token, platform, deviceId } = req.validated.body;

  /* Check if token is already a OneSignal player UUID */
  const isOneSignalUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  let oneSignalPlayerId = isOneSignalUUID ? token : null;

  /* If it's a raw FCM token, try to register with OneSignal */
  if (!isOneSignalUUID) {
    try {
      const { registerTokenWithOneSignal } = await import("../services/notificationService.js");
      oneSignalPlayerId = await registerTokenWithOneSignal(token);
    } catch (err) {
      console.warn("OneSignal registration skipped:", err.message);
    }
  }

  const deviceToken = await prisma.deviceToken.upsert({
    where: { token },
    create: {
      token,
      userId: req.user.id,
      platform: platform || null,
      deviceId: deviceId || null,
      oneSignalPlayerId: oneSignalPlayerId || null
    },
    update: {
      userId: req.user.id,
      platform: platform || null,
      deviceId: deviceId || null,
      ...(oneSignalPlayerId && { oneSignalPlayerId })
    }
  });

  res.status(201).json({ deviceToken: { id: deviceToken.id, platform: deviceToken.platform, oneSignalPlayerId: deviceToken.oneSignalPlayerId } });
});

export const unregisterPushToken = asyncHandler(async (req, res) => {
  const { token, deviceId } = req.validated.body;

  const result = await prisma.deviceToken.deleteMany({
    where: {
      userId: req.user.id,
      ...(token ? { token } : {}),
      ...(deviceId ? { deviceId } : {})
    }
  });

  res.json({ removed: result.count });
});

/* ── Debug: test push notification pipeline (no auth needed) ── */
export const testPushNotification = asyncHandler(async (req, res) => {
  /* Use logged-in user if available, else find first active user with tokens */
  let userId = req.user?.id;
  let companyId = req.user?.companyId;

  if (!userId) {
    const tokenRow = await prisma.deviceToken.findFirst({
      include: { user: { include: { company: true } } },
      orderBy: { updatedAt: "desc" }
    });
    if (!tokenRow) return res.json({ error: "No device tokens in database — install new APK and login first", tokenCount: 0 });
    userId = tokenRow.userId;
    companyId = tokenRow.user?.companyId;
  }

  // 1. Check saved tokens for this user
  const tokens = await prisma.deviceToken.findMany({
    where: { userId },
    select: { token: true, platform: true, createdAt: true, oneSignalPlayerId: true }
  });

  // 2. Send via OneSignal and capture raw response
  let pushResult = null;
  let pushError = null;
  let fcmResponses = [];
  try {
    const apiKey = process.env.ONESIGNAL_API_KEY;
    if (!apiKey) {
      pushError = "ONESIGNAL_API_KEY env var not set";
    } else if (tokens.length > 0) {
        const playerIds = tokens.map(t => t.oneSignalPlayerId).filter(Boolean);
      if (playerIds.length === 0) {
        pushError = `No OneSignal player IDs yet. Tokens: ${tokens.length}, playerIds: 0. Re-login on the new APK to register.`;
      } else {
        /* Force-update all players to subscribed before sending */
        await Promise.all(playerIds.map(pid =>
          fetch(`https://onesignal.com/api/v1/players/${pid}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Key ${apiKey}` },
            body: JSON.stringify({ app_id: "ab220b55-b0ad-422a-9246-fe59d38980a0", notification_types: 1 })
          })
        ));

        const res = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Key ${apiKey}` },
          body: JSON.stringify({
            app_id: "ab220b55-b0ad-422a-9246-fe59d38980a0",
            include_player_ids: playerIds,
            headings: { en: "Test notification ✅" },
            contents: { en: "Push notifications are working!" },
            priority: 10
          })
        });
        const result = await res.json();
        fcmResponses = [result];
        pushResult = `recipients: ${result.recipients ?? 0}, errors: ${JSON.stringify(result.errors ?? null)}`;
      }
    }
  } catch (err) {
    pushError = err.message;
  }

  res.json({
    userId,
    tokenCount: tokens.length,
    savedTokens: tokens,
    fcmResponses,
    pushResult,
    pushError,
    firebaseCredentials: process.env.FIREBASE_SERVICE_ACCOUNT ? "env var found" : "NOT FOUND"
  });
});
