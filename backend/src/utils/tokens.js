import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";

export const createAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      role: user.role.name,
      companyId: user.companyId,
      branchId: user.branchId
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );

export const createRefreshToken = (user) =>
  jwt.sign({ sub: user.id, tokenType: "refresh", jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL
  });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);
