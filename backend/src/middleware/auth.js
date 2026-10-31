import { prisma } from "../config/prisma.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { evaluateCompanyAccess } from "../utils/subscription.js";

const extractBearerToken = (headerValue) => {
  if (!headerValue || typeof headerValue !== "string") return null;

  let token = headerValue.trim();
  if (!token) return null;

  if (/^Bearer\s+/i.test(token)) {
    token = token.replace(/^Bearer\s+/i, "").trim();
  }

  if ((token.startsWith("\"") && token.endsWith("\"")) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }

  while (/^Bearer\s+/i.test(token)) {
    token = token.replace(/^Bearer\s+/i, "").trim();
  }

  return token || null;
};

export const requireAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ message: "Authentication required" });

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true, company: true, branch: true }
    });

    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({ message: "Invalid or inactive user" });
    }
    if (user.role.name !== "SUPER_ADMIN") {
      const access = evaluateCompanyAccess(user.company);
      if (!access.allowed) {
        const message =
          access.reason === "subscription_blocked"
            ? "Service is stopped by Mehman Super Admin. Please clear subscription dues to resume access."
            : "Subscription or demo has expired. Please clear dues to resume access.";
        return res.status(403).json({ message });
      }
    }

    req.user = user;
    req.tenant = {
      companyId: user.companyId,
      branchId: user.branchId,
      role: user.role.name,
      isSuperAdmin: user.role.name === "SUPER_ADMIN"
    };
    next();
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Authentication token expired" });
    }
    res.status(401).json({ message: "Invalid authentication token" });
  }
};

export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role.name)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  next();
};
