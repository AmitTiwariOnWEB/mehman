import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { prisma } from "../config/prisma.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const DEFAULT_FIREBASE_KEY_FILE = "mehman-7f9f2-firebase-adminsdk-fbsvc-a2f455b2b4.json";

const isExpoPushToken = (token) => /^ExponentPushToken\[.+\]$/.test(String(token || ""));
const isUuid = (token) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(token || ""));

const isLikelyFcmToken = (token) => {
  const value = String(token || "").trim();
  return value.length > 50 && !isExpoPushToken(value) && !isUuid(value);
};

const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const stringifyData = (data = {}) => {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
};

const getFirebaseServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();

    const jsonText = raw.startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");

    return JSON.parse(jsonText);
  }

  const keyPath = path.resolve(
    process.cwd(),
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || DEFAULT_FIREBASE_KEY_FILE
  );

  if (!fs.existsSync(keyPath)) {
    throw new Error(`Firebase service account file not found at ${keyPath}`);
  }

  return JSON.parse(fs.readFileSync(keyPath, "utf8"));
};

export const getFirebaseApp = async () => {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccount = getFirebaseServiceAccount();

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
};

export const getFcmAccessToken = async () => {
  const app = await getFirebaseApp();
  return app.options?.credential?.getAccessToken?.() || null;
};

export const registerTokenWithOneSignal = async () => null;

const sendExpoNotifications = async ({ tokens = [], title, body, data = {} }) => {
  const expoTokens = [...new Set(tokens.filter(isExpoPushToken))];
  if (expoTokens.length === 0) return 0;

  try {
    const messages = expoTokens.map((to) => ({
      to,
      title,
      body: body || title,
      sound: "default",
      priority: "high",
      channelId: "default",
      data
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages)
    });

    const result = await res.json();
    console.log("[Expo Push]", JSON.stringify(result));
    return result.data?.filter((row) => row.status === "ok").length || 0;
  } catch (err) {
    console.error("[Expo Push] failed:", err.message);
    return 0;
  }
};

const sendFcmNotifications = async ({ userIds = [], title, body, data = {} }) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0 || !title) return 0;

  try {
    await getFirebaseApp();

    const tokenRows = await prisma.deviceToken.findMany({
      where: { userId: { in: uniqueUserIds } },
      select: { token: true }
    });

    const fcmTokens = [...new Set(tokenRows.map((row) => row.token).filter(isLikelyFcmToken))];
    const expoTokens = [...new Set(tokenRows.map((row) => row.token).filter(isExpoPushToken))];

    let successCount = 0;

    for (const batch of chunk(fcmTokens, 500)) {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: {
          title,
          body: body || title
        },
        data: stringifyData(data),
        android: {
          priority: "high",
          notification: {
            channelId: "default",
            sound: "default",
            visibility: "public"
          }
        }
      });

      console.log(
        "[FCM Push]",
        JSON.stringify({
          successCount: response.successCount,
          failureCount: response.failureCount
        })
      );

      successCount += response.successCount;

      const invalidTokens = [];
      response.responses.forEach((item, index) => {
        const code = item.error?.code || "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          invalidTokens.push(batch[index]);
        }

        if (item.error) {
          console.warn("[FCM Push] Token error:", item.error.code, item.error.message);
        }
      });

      if (invalidTokens.length > 0) {
        await prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
        console.warn(`[FCM Push] Removed ${invalidTokens.length} invalid tokens`);
      }
    }

    successCount += await sendExpoNotifications({ tokens: expoTokens, title, body, data });

    if (successCount === 0) {
      console.warn(
        `[Push] No successful push recipients. FCM tokens: ${fcmTokens.length}, Expo tokens: ${expoTokens.length}`
      );
    }

    return successCount;
  } catch (err) {
    console.error("[FCM Push] failed:", err.message);
    return 0;
  }
};

export const createInAppNotification = async ({ companyId, userId, title, body, data = {} }) => {
  if (!companyId || !userId) return null;

  const notification = await prisma.notification.create({
    data: {
      companyId,
      userId,
      title,
      body,
      status: "SENT",
      channel: "IN_APP",
      data
    }
  });

  await sendFcmNotifications({ userIds: [userId], title, body, data });
  return notification;
};

export const createBulkInAppNotifications = async ({ companyId, userIds = [], title, body, data = {} }) => {
  if (!companyId || !Array.isArray(userIds) || userIds.length === 0) return 0;

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return 0;

  const result = await prisma.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      companyId,
      userId,
      title,
      body,
      status: "SENT",
      channel: "IN_APP",
      data
    }))
  });

  await sendFcmNotifications({ userIds: uniqueUserIds, title, body, data });
  return result.count || 0;
};