import express from "express";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import morgan from "morgan";
import { prisma } from "./config/prisma.js";
import { apiLimiter, corsMiddleware, helmetMiddleware } from "./middleware/security.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import routes from "./routes/index.js";

export const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(apiLimiter);
app.use(express.json({ limit: "8mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "mehman-api" });
});

app.get("/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "reachable" });
  } catch (error) {
    const safeMessage = String(error?.message || "Database connection failed")
      .replace(/mysql:\/\/[^@\s]+@/gi, "mysql://***:***@")
      .replace(/password\s*=\s*[^,\s)]+/gi, "password=***");
    console.error("Database health check failed", {
      name: error?.name,
      code: error?.code,
      message: error?.message
    });
    res.status(503).json({
      status: "error",
      database: "unreachable",
      code: error?.code || error?.name || "DATABASE_ERROR",
      reason: safeMessage
    });
  }
});

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

app.use("/api", routes);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir, { maxAge: "30d" }));

const frontendDistCandidates = [
  path.resolve(process.cwd(), "dist"),
  path.resolve(process.cwd(), "frontend/dist"),
  path.resolve(process.cwd(), "public_html"),
  path.resolve(process.cwd(), "../dist"),
  path.resolve(process.cwd(), "../frontend/dist"),
  path.resolve(process.cwd(), "../public_html"),
  path.resolve(currentDir, "../../dist"),
  path.resolve(currentDir, "../../frontend/dist"),
  path.resolve(currentDir, "../../../public_html")
];

const findFrontendDistPath = () => frontendDistCandidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html")));

const findProjectRoot = () => {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(currentDir, "../.."),
    path.resolve(currentDir, "../../..")
  ];

  return candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "frontend", "package.json")) &&
    fs.existsSync(path.join(candidate, "package.json"))
  );
};

const ensureFrontendBuild = () => {
  if (findFrontendDistPath()) return;

  const projectRoot = findProjectRoot();
  const frontendDir = projectRoot ? path.join(projectRoot, "frontend") : null;
  const viteBinPath = projectRoot ? path.join(projectRoot, "node_modules", "vite", "bin", "vite.js") : null;

  if (!projectRoot || !frontendDir || !viteBinPath || !fs.existsSync(viteBinPath)) {
    console.warn("Mehman frontend build not found, and Vite is unavailable for runtime build.");
    return;
  }

  for (const binaryPath of [
    path.join(projectRoot, "node_modules", "vite", "node_modules", "esbuild", "lib", "downloaded-@esbuild-linux-x64-esbuild"),
    path.join(projectRoot, "node_modules", "@esbuild", "linux-x64", "bin", "esbuild")
  ]) {
    if (fs.existsSync(binaryPath)) {
      try {
        fs.chmodSync(binaryPath, 0o755);
      } catch (error) {
        console.warn(`Unable to mark ${binaryPath} executable: ${error.message}`);
      }
    }
  }

  console.log("Mehman frontend build not found. Building frontend before serving web app...");
  const result = spawnSync(process.execPath, [viteBinPath, "build"], {
    cwd: frontendDir,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    console.error(`Mehman frontend runtime build failed with exit code ${result.status}`);
  }
};

ensureFrontendBuild();
const frontendDistPath = findFrontendDistPath();

if (frontendDistPath) {
  app.use(express.static(frontendDistPath));
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) ||
      req.path === "/health" ||
      req.path.startsWith("/api/")
    ) {
      return next();
    }

    return res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);
