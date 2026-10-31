import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const builtServerPath = path.join(rootDir, "backend", "dist", "server.js");
const frontendIndexCandidates = [
  path.join(rootDir, "dist", "index.html"),
  path.join(rootDir, "frontend", "dist", "index.html"),
  path.join(rootDir, "..", "public_html", "index.html")
];

const hasFrontendBuild = () => frontendIndexCandidates.some((candidate) => fs.existsSync(candidate));

if (!hasFrontendBuild()) {
  const viteBinPath = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
  const frontendDir = path.join(rootDir, "frontend");
  const esbuildBinaryCandidates = [
    path.join(rootDir, "node_modules", "vite", "node_modules", "esbuild", "lib", "downloaded-@esbuild-linux-x64-esbuild"),
    path.join(rootDir, "node_modules", "@esbuild", "linux-x64", "bin", "esbuild")
  ];

  if (fs.existsSync(viteBinPath) && fs.existsSync(frontendDir)) {
    for (const binaryPath of esbuildBinaryCandidates) {
      if (fs.existsSync(binaryPath)) {
        try {
          fs.chmodSync(binaryPath, 0o755);
        } catch (error) {
          console.warn(`Unable to mark ${binaryPath} executable: ${error.message}`);
        }
      }
    }

    console.log("Mehman frontend build not found. Building frontend before startup...");
    const result = spawnSync(process.execPath, [viteBinPath, "build"], {
      cwd: frontendDir,
      stdio: "inherit"
    });

    if (result.status !== 0) {
      console.error(`Mehman frontend build failed with exit code ${result.status}`);
    }
  } else {
    console.warn("Mehman frontend build not found, and Vite is unavailable at runtime.");
  }
}

try {
  if (fs.existsSync(builtServerPath)) {
    await import("./backend/dist/server.js");
  } else {
    await import("./backend/src/server.js");
  }
} catch (error) {
  console.error("Mehman startup failed");
  console.error(error?.stack || error);
  process.exit(1);
}
