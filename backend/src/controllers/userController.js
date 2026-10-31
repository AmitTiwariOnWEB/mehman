import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { createInAppNotification } from "../services/notificationService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createUserSchema = z.object({
  body: z.object({
    role: z.enum(["SECURITY_GUARD", "FLAT_OWNER", "RECEPTIONIST"]),
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    password: z.string().min(8),
    branchId: z.preprocess((value) => value === "" ? undefined : value, z.string().uuid().optional()),
    badgeNumber: z.string().optional(),
    shiftLabel: z.string().optional(),
    flatNumber: z.string().optional(),
    tower: z.string().optional(),
    floor: z.string().optional(),
    intercom: z.string().optional()
  })
});

export const assignGuardGateSchema = z.object({
  body: z.object({
    branchId: z.string().uuid()
  })
});

export const listUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    where: req.tenant.isSuperAdmin ? {} : { companyId: req.user.companyId },
    orderBy: { createdAt: "desc" },
    include: { role: true, branch: true, guardProfile: true, ownedFlats: true, ownedFlats2: true },
    take: 100
  });

  res.json({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role.name,
      branch: user.branch,
      guard: user.guardProfile,
      /* merge both ownership slots so frontend sees all flats this user belongs to */
      flats: [...user.ownedFlats, ...user.ownedFlats2],
      status: user.status
    }))
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const branchId = req.validated.body.branchId || null;
  if (!companyId) return res.status(400).json({ message: "Society context is required" });

  if (branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: branchId, companyId } });
    if (!branch) return res.status(404).json({ message: "Gate not found for this society" });
  }

  if (req.validated.body.role === "SECURITY_GUARD" && !req.validated.body.badgeNumber) {
    return res.status(422).json({ message: "badgeNumber is required for guards" });
  }

  if (req.validated.body.role === "FLAT_OWNER" && !req.validated.body.flatNumber) {
    return res.status(422).json({ message: "flatNumber is required for flat owners" });
  }

  const role = await prisma.role.findUnique({ where: { name: req.validated.body.role } });
  const passwordHash = await bcrypt.hash(req.validated.body.password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        companyId,
        branchId,
        roleId: role.id,
        name: req.validated.body.name,
        email: req.validated.body.email.toLowerCase(),
        phone: req.validated.body.phone,
        passwordHash,
        mustChangePassword: true
      },
      include: { role: true }
    });

    let guard = null;
    let flat = null;

    if (req.validated.body.role === "SECURITY_GUARD") {
      guard = await tx.guard.create({
        data: {
          companyId,
          branchId,
          userId: user.id,
          badgeNumber: req.validated.body.badgeNumber,
          shiftLabel: req.validated.body.shiftLabel
        }
      });
    }

    if (req.validated.body.role === "FLAT_OWNER") {
      /* Try to find existing flat by flatNumber (ignore branchId for lookup so flat
         created without a gate can still be found) */
      const existingFlat = await tx.flat.findFirst({
        where: { companyId, flatNumber: req.validated.body.flatNumber }
      });

      if (existingFlat) {
        if (existingFlat.ownerId && existingFlat.owner2Id) {
          /* Both slots taken — reject */
          return res.status(422).json({ message: "This flat already has 2 resident IDs. Remove one before adding another." });
        }
        /* Fill the free slot without overwriting the occupied one */
        flat = await tx.flat.update({
          where: { id: existingFlat.id },
          data: existingFlat.ownerId
            ? { owner2Id: user.id }
            : {
                ownerId: user.id,
                tower: req.validated.body.tower || existingFlat.tower,
                floor: req.validated.body.floor || existingFlat.floor,
                intercom: req.validated.body.intercom || existingFlat.intercom
              }
        });
      } else {
        flat = await tx.flat.create({
          data: {
            companyId,
            branchId,
            ownerId: user.id,
            flatNumber: req.validated.body.flatNumber,
            tower: req.validated.body.tower,
            floor: req.validated.body.floor,
            intercom: req.validated.body.intercom
          }
        });
      }
    }

    return { user, guard, flat };
  });

  res.status(201).json({
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role.name
    },
    guard: result.guard,
    flat: result.flat
  });
});

export const assignGuardGate = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const { branchId } = req.validated.body;
  if (!companyId) return res.status(400).json({ message: "Society context is required" });

  const [branch, guardUser] = await Promise.all([
    prisma.branch.findFirst({ where: { id: branchId, companyId, isActive: true } }),
    prisma.user.findFirst({
      where: { id: req.params.id, companyId },
      include: { role: true, guardProfile: true }
    })
  ]);

  if (!branch) return res.status(404).json({ message: "Gate not found for this society" });
  if (!guardUser || guardUser.role.name !== "SECURITY_GUARD" || !guardUser.guardProfile) {
    return res.status(404).json({ message: "Security guard not found for this society" });
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: guardUser.id },
      data: { branchId },
      include: { role: true, branch: true, guardProfile: true }
    });

    const guard = await tx.guard.update({
      where: { userId: guardUser.id },
      data: { branchId },
      include: { branch: true }
    });

    return { user, guard };
  });

  await createInAppNotification({
    companyId,
    userId: guardUser.id,
    title: "Gate assignment updated",
    body: `Admin changed your assigned gate to ${branch.name}.`,
    data: {
      type: "GUARD_GATE_CHANGED",
      gateId: branch.id,
      gateName: branch.name
    }
  });

  res.json({
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role.name,
      branch: result.user.branch,
      guard: result.guard
    }
  });
});
