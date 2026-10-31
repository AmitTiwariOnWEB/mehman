import { Router } from "express";
import { createBranch, createBranchSchema, listBranches } from "../controllers/branchController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(requireAuth);
router.get("/", listBranches);
router.post("/", requireRoles("SOCIETY_ADMIN"), validate(createBranchSchema), createBranch);

export default router;
