import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "../config/env.js";

export const helmetMiddleware = helmet();

const allowedOrigins = env.WEB_ORIGIN.split(",").map((origin) => origin.trim());
const isPrivateNetworkOrigin = (origin) => {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      ["5173", "5180"].includes(url.port) &&
      /^(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/.test(url.hostname)
    );
  } catch {
    return false;
  }
};

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isPrivateNetworkOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 5000),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests, please wait a moment and try again." },
  skip: (req) => req.path === "/health" || req.path === "/health/db"
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 500),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many login attempts, please wait a moment and try again." }
});
