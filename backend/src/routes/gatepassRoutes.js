import { Router } from "express";
import { getEntryLogs, getGatepass, getGatepassQrImage, scanGatepass, scanSchema, updateGatepassStatus, updateGatepassStatusSchema } from "../controllers/gatepassController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get("/:id/qr", getGatepassQrImage);
router.use(requireAuth);
router.get("/logs", requireRoles("SOCIETY_ADMIN", "SUPER_ADMIN"), getEntryLogs);
router.get("/:id", getGatepass);
router.patch(
  "/:id/status",
  requireRoles("FLAT_OWNER", "SECURITY_GUARD", "SOCIETY_ADMIN", "SUPER_ADMIN"),
  validate(updateGatepassStatusSchema),
  updateGatepassStatus
);
router.post(
  "/scan",
  requireRoles("SECURITY_GUARD", "SOCIETY_ADMIN", "SUPER_ADMIN"),
  validate(scanSchema),
  scanGatepass
);

export default router;
