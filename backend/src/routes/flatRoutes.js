import { Router } from "express";
import { createFlat, listFlats, updateFlat } from "../controllers/flatController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  requireRoles("SECURITY_GUARD", "FLAT_OWNER", "SOCIETY_ADMIN", "SUPER_ADMIN"),
  listFlats
);

router.post(
  "/",
  requireRoles("SOCIETY_ADMIN", "SUPER_ADMIN"),
  createFlat
);

router.patch(
  "/:id",
  requireRoles("SOCIETY_ADMIN", "SUPER_ADMIN"),
  updateFlat
);

export default router;
