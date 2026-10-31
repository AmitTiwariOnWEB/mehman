import { Router } from "express";
import {
  castOperationVote,
  castOperationVoteSchema,
  createOperation,
  createOperationSchema,
  getOperation,
  listOperations,
  reportOperationPayment,
  reportOperationPaymentSchema,
  updateOperation,
  updateOperationSchema
} from "../controllers/operationController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(requireAuth);
router.get("/", listOperations);
router.get("/:id", getOperation);
router.post("/", validate(createOperationSchema), createOperation);
router.post("/:id/vote", validate(castOperationVoteSchema), castOperationVote);
router.post("/:id/report-payment", validate(reportOperationPaymentSchema), reportOperationPayment);
router.patch("/:id", validate(updateOperationSchema), updateOperation);

export default router;
