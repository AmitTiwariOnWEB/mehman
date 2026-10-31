import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "./env.js";

const buildMariaDbAdapter = (databaseUrl) => {
  const url = new URL(databaseUrl);

  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    connectionLimit: Number(url.searchParams.get("connection_limit") || 5),
    connectTimeout: Number(url.searchParams.get("connect_timeout") || 5000)
  });
};

export const prisma = new PrismaClient({
  adapter: buildMariaDbAdapter(env.DATABASE_URL),
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"]
});
