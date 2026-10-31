import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const extractFeaturesFromCatalogSection = (content, sectionStart, sectionEnd) => {
  const start = content.indexOf(sectionStart);
  const end = content.indexOf(sectionEnd, start + sectionStart.length);
  if (start === -1 || end === -1) return [];
  const section = content.slice(start, end);
  const matches = [...section.matchAll(/features:\s*\[([\s\S]*?)\]/g)];
  const features = new Set();
  matches.forEach((match) => {
    [...match[1].matchAll(/"([^"]+)"/g)].forEach((item) => features.add(item[1]));
  });
  return [...features];
};

const extractHandledFeatures = (content) => {
  const handled = new Set();
  [...content.matchAll(/if\s*\(feature\s*===\s*"([^"]+)"\)\s*return/g)].forEach((match) => handled.add(match[1]));
  return handled;
};

const runBuild = (workspace) =>
  execSync(`npm run build --workspace ${workspace}`, {
    cwd: rootDir,
    stdio: "pipe",
    encoding: "utf8"
  });

const normalizeApiPath = (rawPath) =>
  rawPath
    .replace(/\$\{[^}]+\}/g, ":param")
    .replace(/\/+/g, "/")
    .trim();

const getApiRoot = (apiPath) => {
  const firstSegment = apiPath.split("/").filter(Boolean)[0] || "";
  const cleaned = (firstSegment.match(/^[a-zA-Z0-9_-]+/) || [firstSegment])[0];
  return cleaned ? `/${cleaned}` : "/";
};

const extractFrontendApiPaths = (content) => {
  const found = new Set();
  [...content.matchAll(/apiRequest\(\s*(?:`([^`]+)`|"([^"]+)")/g)].forEach((match) => {
    const raw = match[1] || match[2];
    if (!raw || !raw.startsWith("/")) return;
    found.add(normalizeApiPath(raw));
  });
  return [...found];
};

const extractBackendRouteRoots = (indexRoutesContent) => {
  const roots = new Set();
  [...indexRoutesContent.matchAll(/router\.use\("([^"]+)"/g)].forEach((match) => roots.add(match[1]));
  return roots;
};

const frontendFeatureCatalog = read("frontend/src/lib/featureCatalog.js");
const adminFeaturePage = read("frontend/src/components/AdminFeaturePage.jsx");
const superAdminFeaturePage = read("frontend/src/components/SuperAdminPages.jsx");
const frontendApi = read("frontend/src/lib/api.js");
const backendIndexRoutes = read("backend/src/routes/index.js");
const liveActivityComponent = read("frontend/src/components/LiveActivity.jsx");

const societyMenuFeatures = extractFeaturesFromCatalogSection(
  frontendFeatureCatalog,
  "export const featureGroups = {",
  "/* Mobile-only catalogs */"
);
const superAdminMenuFeatures = extractFeaturesFromCatalogSection(
  frontendFeatureCatalog,
  "export const superAdminGroups = {",
  "/* -- Society Admin menu -- */"
);

const adminHandledFeatures = extractHandledFeatures(adminFeaturePage);
const superAdminHandledFeatures = extractHandledFeatures(superAdminFeaturePage);

const missingSocietyFeaturePages = societyMenuFeatures.filter((feature) => !adminHandledFeatures.has(feature));
const missingSuperAdminFeaturePages = superAdminMenuFeatures.filter((feature) => !superAdminHandledFeatures.has(feature));

const frontendApiPaths = extractFrontendApiPaths(frontendApi);
const backendRoots = extractBackendRouteRoots(backendIndexRoutes);
const unknownApiRoots = frontendApiPaths
  .map((apiPath) => ({ apiPath, root: getApiRoot(apiPath) }))
  .filter(({ root }) => root && !backendRoots.has(root))
  .map(({ apiPath }) => apiPath);

const qaWarnings = [];
if (/mockData/.test(liveActivityComponent)) {
  qaWarnings.push("LiveActivity uses mockData import; replace with realtime data source.");
}

let backendBuild = "not_run";
let frontendBuild = "not_run";
let buildError = "";

try {
  runBuild("backend");
  backendBuild = "ok";
  runBuild("frontend");
  frontendBuild = "ok";
} catch (error) {
  buildError = error?.stdout || error?.message || "Unknown build error";
}

const hasFailures =
  missingSocietyFeaturePages.length > 0 ||
  missingSuperAdminFeaturePages.length > 0 ||
  unknownApiRoots.length > 0 ||
  backendBuild !== "ok" ||
  frontendBuild !== "ok";

const report = {
  timestamp: new Date().toISOString(),
  status: hasFailures ? "FAIL" : "PASS",
  checks: {
    build: { backend: backendBuild, frontend: frontendBuild },
    societyMenuRouting: { total: societyMenuFeatures.length, missing: missingSocietyFeaturePages },
    superAdminMenuRouting: { total: superAdminMenuFeatures.length, missing: missingSuperAdminFeaturePages },
    frontendApiRoots: { totalPaths: frontendApiPaths.length, unknownRoots: unknownApiRoots },
    warnings: qaWarnings
  }
};

console.log("=== Mehman Automation QA Report ===");
console.log(JSON.stringify(report, null, 2));

if (buildError) {
  console.log("\n--- Build Output (trimmed) ---");
  console.log(buildError.slice(0, 4000));
}

if (hasFailures) {
  process.exitCode = 1;
}
