import { Router } from "express";
import { dashboard } from "../controllers/analyticsController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRoles("SUPER_ADMIN", "SOCIETY_ADMIN", "RECEPTIONIST"));
router.get("/dashboard", dashboard);

export default router;
