import { Router } from "express";
import { createVisitor, createVisitorSchema, listVisitors } from "../controllers/visitorController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(requireAuth);
router.get("/", listVisitors);
router.post(
  "/",
  requireRoles("SOCIETY_ADMIN", "FLAT_OWNER", "RECEPTIONIST", "SECURITY_GUARD"),
  validate(createVisitorSchema),
  createVisitor
);

export default router;
