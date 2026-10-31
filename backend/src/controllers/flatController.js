import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listFlats = asyncHandler(async (req, res) => {
  const isAdmin = ["SOCIETY_ADMIN", "SUPER_ADMIN"].includes(req.user.role?.name);

  const flats = await prisma.flat.findMany({
    where: {
      companyId: req.user.companyId,
      /* Admins see all flats (including inactive) so they can toggle status */
      ...(isAdmin ? {} : { isActive: true }),
      ...(req.query.branchId ? { branchId: String(req.query.branchId) } : {}),
      ...(req.query.tower ? { tower: String(req.query.tower) } : {}),
      ...(req.query.floor ? { floor: String(req.query.floor) } : {})
    },
    orderBy: [{ tower: "asc" }, { floor: "asc" }, { flatNumber: "asc" }],
    include: {
      owner:  { select: { id: true, name: true, phone: true } },
      owner2: { select: { id: true, name: true, phone: true } },
      branch: { select: { id: true, name: true, code: true } }
    }
  });

  const towers = [...new Set(flats.map((flat) => flat.tower).filter(Boolean))];
  const floors = [...new Set(flats.map((flat) => flat.floor).filter(Boolean))];

  res.json({ flats, towers, floors });
});

export const createFlat = asyncHandler(async (req, res) => {
  const { flatNumber, tower, floor, isActive = true } = req.body;

  if (!flatNumber) {
    return res.status(422).json({ message: "flatNumber is required" });
  }

  const flat = await prisma.flat.create({
    data: {
      companyId:  req.user.companyId,
      flatNumber: String(flatNumber).trim(),
      tower:      tower ? String(tower).trim() : null,
      floor:      floor ? String(floor).trim() : null,
      isActive:   Boolean(isActive)
    }
  });

  res.status(201).json({ flat });
});

export const updateFlat = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive, tower, floor, flatNumber } = req.body;

  const existing = await prisma.flat.findFirst({
    where: { id, companyId: req.user.companyId }
  });

  if (!existing) {
    return res.status(404).json({ message: "Flat not found" });
  }

  const flat = await prisma.flat.update({
    where: { id },
    data: {
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      ...(tower !== undefined ? { tower: tower ? String(tower).trim() : null } : {}),
      ...(floor !== undefined ? { floor: floor ? String(floor).trim() : null } : {}),
      ...(flatNumber !== undefined ? { flatNumber: String(flatNumber).trim() } : {})
    }
  });

  res.json({ flat });
});
