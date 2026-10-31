import { Router } from "express";
import {
  listSocieties,
  onboardSociety,
  onboardSocietySchema,
  updateSocietySubscription,
  updateSocietySubscriptionSchema
} from "../controllers/societyController.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(requireAuth, requireRoles("SUPER_ADMIN"));
router.get("/", listSocieties);
router.post("/onboard", validate(onboardSocietySchema), onboardSociety);
router.patch("/:id/subscription", validate(updateSocietySubscriptionSchema), updateSocietySubscription);

export default router;
