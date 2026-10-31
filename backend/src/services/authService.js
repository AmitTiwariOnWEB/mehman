import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import { prisma } from "../config/prisma.js";
import { sha256 } from "../utils/crypto.js";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../utils/tokens.js";
import { evaluateCompanyAccess, getNormalizedSubscription } from "../utils/subscription.js";

const getClientType = (company) => {
  const value = company?.settings?.clientType;
  return value === "CORPORATE" ? "CORPORATE" : "SOCIETY";
};

export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role.name,
  mustChangePassword: user.mustChangePassword ?? false,
  companyId: user.companyId,
  branchId: user.branchId,
  company: user.company
    ? {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
        isActive: user.company.isActive,
        clientType: getClientType(user.company),
        subscription: (() => {
          const subscription = getNormalizedSubscription(user.company.settings || {});
          const access = evaluateCompanyAccess(user.company);
          return {
            ...subscription,
            startsAt: subscription.startsAt.toISOString(),
            expiresAt: subscription.expiresAt.toISOString(),
            effectiveStatus: access.effectiveStatus,
            warning: access.warning || null,
            accessAllowed: access.allowed,
            accessReason: access.reason
          };
        })()
      }
    : null,
  branch: user.branch ? { id: user.branch.id, name: user.branch.name, code: user.branch.code } : null,
  guard: user.guardProfile ? { badgeNumber: user.guardProfile.badgeNumber, shiftLabel: user.guardProfile.shiftLabel } : null,
  flats: [...(user.ownedFlats || []), ...(user.ownedFlats2 || [])].map((flat) => ({
    flatNumber: flat.flatNumber,
    tower: flat.tower,
    floor: flat.floor
  }))
});

const ensureCompanySubscription = (user) => {
  if (!user || user.role?.name === "SUPER_ADMIN") return;
  const access = evaluateCompanyAccess(user.company);
  if (!access.allowed) {
    const message =
      access.reason === "subscription_blocked"
        ? "Service is stopped by Mehman Super Admin. Please clear subscription dues to resume access."
        : "Subscription or demo has expired. Please clear dues to resume access.";
    throw Object.assign(
      new Error(message),
      { statusCode: 403 }
    );
  }
};

const createSession = async (user, password) => {
  if (!user || user.status !== "ACTIVE") {
    throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
  ensureCompanySubscription(user);

  const refreshToken = createRefreshToken(user);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: dayjs().add(30, "day").toDate()
    }
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    user: publicUser(user),
    accessToken: createAccessToken(user),
    refreshToken
  };
};

export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { role: true, company: true, branch: true, guardProfile: true, ownedFlats: true, ownedFlats2: true }
  });

  return createSession(user, password);
};

export const mobileLogin = async ({ identifier, password }) => {
  const loginId = identifier.trim();
  const emailUser = loginId.includes("@")
    ? await prisma.user.findUnique({
        where: { email: loginId.toLowerCase() },
        include: { role: true, company: true, branch: true, guardProfile: true, ownedFlats: true, ownedFlats2: true }
      })
    : null;

  if (emailUser) return createSession(emailUser, password);

  const guard = await prisma.guard.findFirst({
    where: { badgeNumber: { equals: loginId } },
    include: { user: { include: { role: true, company: true, branch: true, guardProfile: true, ownedFlats: true, ownedFlats2: true } } }
  });

  if (guard) return createSession(guard.user, password);

  const flat = await prisma.flat.findFirst({
    where: { flatNumber: { equals: loginId }, OR: [{ ownerId: { not: null } }, { owner2Id: { not: null } }] },
    include: {
      owner: { include: { role: true, company: true, branch: true, guardProfile: true, ownedFlats: true, ownedFlats2: true } },
      owner2: { include: { role: true, company: true, branch: true, guardProfile: true, ownedFlats: true, ownedFlats2: true } }
    }
  });

  for (const candidate of [flat?.owner, flat?.owner2].filter(Boolean)) {
    try {
      return await createSession(candidate, password);
    } catch (error) {
      if (error?.statusCode !== 401) throw error;
    }
  }

  return createSession(null, password);
};

export const refresh = async (token) => {
  const payload = verifyRefreshToken(token);
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { role: true, company: true, branch: true, ownedFlats: true, ownedFlats2: true } } }
  });

  if (!payload || !tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
    throw Object.assign(new Error("Invalid refresh token"), { statusCode: 401 });
  }
  ensureCompanySubscription(tokenRecord.user);

  return {
    user: publicUser(tokenRecord.user),
    accessToken: createAccessToken(tokenRecord.user)
  };
};

export const currentUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, company: true, branch: true, guardProfile: true, ownedFlats: true, ownedFlats2: true }
  });

  if (!user || user.status !== "ACTIVE") {
    throw Object.assign(new Error("Invalid or inactive user"), { statusCode: 401 });
  }
  ensureCompanySubscription(user);

  return publicUser(user);
};

export const logout = (token) =>
  prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() }
  });

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw Object.assign(new Error("Current password is incorrect"), { statusCode: 400 });

  if (newPassword.length < 8) throw Object.assign(new Error("New password must be at least 8 characters"), { statusCode: 400 });

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash, mustChangePassword: false }
  });
};
