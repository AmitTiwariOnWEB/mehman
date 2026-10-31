import { Router } from "express";
import { changePassword, changePasswordSchema, login, loginSchema, logout, me, mobileLogin, mobileLoginSchema, refresh, refreshSchema } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/mobile-login", authLimiter, validate(mobileLoginSchema), mobileLogin);
router.post("/refresh", authLimiter, validate(refreshSchema), refresh);
router.post("/logout", requireAuth, validate(refreshSchema), logout);
router.get("/me", requireAuth, me);
router.post("/change-password", requireAuth, validate(changePasswordSchema), changePassword);

export default router;
