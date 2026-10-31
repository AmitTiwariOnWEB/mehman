import { Router } from "express";
import { syncContacts, syncContactsSchema } from "../controllers/contactController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(requireAuth);
router.post("/sync", validate(syncContactsSchema), syncContacts);

export default router;
