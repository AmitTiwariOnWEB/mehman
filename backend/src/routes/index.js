import { Router } from "express";
import analyticsRoutes from "./analyticsRoutes.js";
import authRoutes from "./authRoutes.js";
import branchRoutes from "./branchRoutes.js";
import contactRoutes from "./contactRoutes.js";
import flatRoutes from "./flatRoutes.js";
import gatepassRoutes from "./gatepassRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import operationRoutes from "./operationRoutes.js";
import societyRoutes from "./societyRoutes.js";
import userRoutes from "./userRoutes.js";
import visitorRoutes from "./visitorRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/branches", branchRoutes);
router.use("/contacts", contactRoutes);
router.use("/flats", flatRoutes);
router.use("/gatepasses", gatepassRoutes);
router.use("/notifications", notificationRoutes);
router.use("/operations", operationRoutes);
router.use("/societies", societyRoutes);
router.use("/users", userRoutes);
router.use("/visitors", visitorRoutes);

export default router;
