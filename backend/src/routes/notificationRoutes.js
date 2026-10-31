import { Router } from "express";
import {
  listNotifications,
  markNotificationRead,
  markNotificationsRead,
  registerPushToken,
  registerPushTokenSchema,
  unregisterPushToken,
  unregisterPushTokenSchema,
  testPushNotification
} from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

/* No-auth diagnostics — remove after debugging */
router.get("/ping", (req, res) => {
  res.json({
    version: "v9",
    oneSignalApiKey: process.env.ONESIGNAL_API_KEY ? "set ✅" : "MISSING ❌",
    jwtSecretSet: process.env.JWT_ACCESS_SECRET ? "set ✅" : "MISSING ❌",
    nodeEnv: process.env.NODE_ENV || "not set"
  });
});

router.post("/test-push", testPushNotification);

router.use(requireAuth);
router.get("/", listNotifications);
router.post("/push-token", validate(registerPushTokenSchema), registerPushToken);
router.post("/push-token/unregister", validate(unregisterPushTokenSchema), unregisterPushToken);
router.patch("/read", markNotificationsRead);
router.patch("/:id/read", markNotificationRead);

export default router;
