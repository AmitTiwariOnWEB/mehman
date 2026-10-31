import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createBranchSchema = z.object({
  body: z.object({
    companyId: z.string().uuid().optional(),
    name: z.string().min(2),
    code: z.string().min(2),
    address: z.string().min(5),
    city: z.string().optional(),
    state: z.string().optional()
  })
});

export const listBranches = asyncHandler(async (req, res) => {
  const branches = await prisma.branch.findMany({
    where: req.tenant.isSuperAdmin ? {} : { companyId: req.user.companyId },
    orderBy: { name: "asc" }
  });
  res.json({ branches });
});

export const createBranch = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  if (!companyId) return res.status(400).json({ message: "Society context is required to create gates" });

  const branch = await prisma.branch.create({
    data: { ...req.validated.body, companyId, code: req.validated.body.code.toUpperCase() }
  });
  res.status(201).json({ branch });
});
