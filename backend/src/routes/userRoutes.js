import { Router } from "express";
import { assignGuardGate, assignGuardGateSchema, createUser, createUserSchema, listUsers } from "../controllers/userController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(requireAuth, requireRoles("SOCIETY_ADMIN", "SUPER_ADMIN"));
router.get("/", listUsers);
router.post("/", validate(createUserSchema), createUser);
router.patch("/:id/gate", validate(assignGuardGateSchema), assignGuardGate);

export default router;
