import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const PLANNED_MCP_URL = "https://mcp.botopticon.com/mcp";
export const WORKING_MCP_URL = "https://www.botopticon.com/api/mcp";

const SECRET_RE = /bot_[A-Za-z0-9]{6,}|sk_(?:live|test)_[A-Za-z0-9]/;
const NAME_RE = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PATH_FIELDS = ["logo", "skills", "rules", "agents", "commands", "hooks", "mcpServers"];
const BRAND_NEEDLE = ["coriolis", "agency"].join("");

export function validatePlugin(root) {
  const errors = [];
  root = resolve(root);
  const manifest = readManifest(root, errors);
  if (manifest) checkManifestPaths(root, manifest, errors);
  checkMcp(root, manifest, errors);
  checkSkills(root, manifest, errors);
  checkCommands(root, manifest, errors);
  checkRules(root, manifest, errors);
  checkReadme(root, errors);
  checkBranding(root, errors);
  return errors;
}

function readManifest(root, errors) {
  const relPath = join(".cursor-plugin", "plugin.json");
  const full = join(root, relPath);
  if (!existsSync(full)) {
    errors.push(`${relPath} is missing`);
    return null;
  }
  const raw = readFileSync(full, "utf8");
  if (SECRET_RE.test(raw)) errors.push(`${relPath} contains a secret`);
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    errors.push(`${relPath} is not valid JSON (${error.message})`);
    return null;
  }
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    errors.push(`${relPath} must be a JSON object`);
    return null;
  }
  if (typeof manifest.name !== "string" || !NAME_RE.test(manifest.name)) {
    errors.push(`${relPath} name must be lowercase and start and end with an alphanumeric`);
  }
  return manifest;
}

function checkManifestPaths(root, manifest, errors) {
  for (const field of PATH_FIELDS) {
    if (manifest[field] == null) continue;
    const value = manifest[field];
    if (typeof value === "string") {
      checkOnePath(root, field, value, errors);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item !== "string") {
          errors.push(`${field}[${index}] must be a relative path`);
          return;
        }
        checkOnePath(root, `${field}[${index}]`, item, errors);
      });
    } else if (typeof value === "object") {
      continue;
    } else {
      errors.push(`${field} must be a relative path or a list of paths`);
    }
  }
}

function checkOnePath(root, label, filePath, errors) {
  const problem = relativePathProblem(filePath);
  if (problem) {
    errors.push(`${label} (${filePath}) ${problem}`);
    return;
  }
  if (!existsSync(join(root, filePath))) {
    errors.push(`${label} (${filePath}) does not exist`);
  }
}

function relativePathProblem(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") return "is empty";
  if (filePath.includes("://") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(filePath)) {
    return "must be relative (no scheme)";
  }
  if (filePath.startsWith("/") || filePath.startsWith("\\")) {
    return "must be relative (no leading slash)";
  }
  if (filePath.split(/[\\/]/).includes("..")) return "must not contain ..";
  return null;
}

function checkMcp(root, manifest, errors) {
  const files = new Set([join(root, "mcp.json")]);
  const declared = manifest?.mcpServers;
  const declaredPaths = typeof declared === "string" ? [declared] : Array.isArray(declared) ? declared : [];
  for (const filePath of declaredPaths) {
    if (typeof filePath === "string" && !relativePathProblem(filePath)) {
      files.add(join(root, filePath));
    }
  }
  for (const full of files) {
    const label = relative(root, full) || "mcp.json";
    if (!existsSync(full)) {
      errors.push(`${label} is missing`);
      continue;
    }
    const raw = readFileSync(full, "utf8");
    if (SECRET_RE.test(raw)) errors.push(`${label} contains a secret`);
    if (raw.toLowerCase().includes("authorization")) errors.push(`${label} contains authorization text`);
    let mcp;
    try {
      mcp = JSON.parse(raw);
    } catch (error) {
      errors.push(`${label} is not valid JSON (${error.message})`);
      continue;
    }
    if (hasKey(mcp, "headers")) errors.push(`${label} contains a headers key`);
    const servers = mcp?.mcpServers;
    if (servers === null || typeof servers !== "object" || Array.isArray(servers)) {
      errors.push(`${label} must contain an mcpServers object`);
      continue;
    }
    const names = Object.keys(servers);
    if (names.length !== 1 || names[0] !== "botopticon") {
      errors.push(`${label} must contain exactly one server named botopticon`);
      continue;
    }
    const server = servers.botopticon;
    const keys = server && typeof server === "object" ? Object.keys(server) : [];
    if (keys.length !== 1 || keys[0] !== "url") {
      errors.push(`${label} botopticon server must have only a url`);
      continue;
    }
    if (server.url !== PLANNED_MCP_URL && server.url !== WORKING_MCP_URL) {
      errors.push(`${label} url must be the planned or working MCP URL`);
    }
  }
}

function hasKey(value, key) {
  if (Array.isArray(value)) return value.some((item) => hasKey(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([name, child]) => name === key || hasKey(child, key));
  }
  return false;
}

function checkSkills(root, manifest, errors) {
  const files = collect(root, manifest, "skills", "skills", (file) => basename(file) === "SKILL.md");
  if (files.length === 0) {
    errors.push("expected at least one skills/**/SKILL.md");
    return;
  }
  for (const file of files) {
    const fm = readFrontmatter(file, root, errors);
    if (!fm) continue;
    const label = relative(root, file);
    const dirName = basename(dirname(file));
    if (typeof fm.name !== "string" || !KEBAB_RE.test(fm.name)) {
      errors.push(`${label} name must be kebab-case`);
    } else if (fm.name !== dirName) {
      errors.push(`${label} name must match its directory (${dirName})`);
    }
    if (typeof fm.description !== "string" || fm.description.trim() === "") {
      errors.push(`${label} description must be non-empty`);
    }
  }
}

function checkCommands(root, manifest, errors) {
  const files = collect(root, manifest, "commands", "commands", (file) => extname(file) === ".md");
  for (const file of files) {
    const fm = readFrontmatter(file, root, errors);
    if (!fm) continue;
    const label = relative(root, file);
    const stem = basename(file, ".md");
    if (typeof fm.name !== "string" || !KEBAB_RE.test(fm.name)) {
      errors.push(`${label} name must be kebab-case`);
    } else if (fm.name !== stem) {
      errors.push(`${label} name must match its filename (${stem})`);
    }
    if (typeof fm.description !== "string" || fm.description.trim() === "") {
      errors.push(`${label} description must be non-empty`);
    }
  }
}

function checkRules(root, manifest, errors) {
  const files = collect(
    root,
    manifest,
    "rules",
    "rules",
    (file) => extname(file) === ".md" || extname(file) === ".mdc",
  );
  for (const file of files) {
    const fm = readFrontmatter(file, root, errors);
    if (!fm) continue;
    const label = relative(root, file);
    if (typeof fm.description !== "string" || fm.description.trim() === "") {
      errors.push(`${label} description must be non-empty`);
    }
    if ("alwaysApply" in fm && typeof fm.alwaysApply !== "boolean") {
      errors.push(`${label} alwaysApply must be a boolean`);
    }
  }
}

function collect(root, manifest, field, fallback, pred) {
  const declared = manifest?.[field];
  const paths = typeof declared === "string" ? [declared] : Array.isArray(declared) ? declared : [fallback];
  const files = [];
  for (const filePath of paths) {
    if (typeof filePath !== "string" || relativePathProblem(filePath)) continue;
    walkFiles(join(root, filePath), pred, files);
  }
  return files;
}

function walkFiles(target, pred, out) {
  if (!existsSync(target)) return out;
  const stat = statSync(target);
  if (stat.isFile()) {
    if (pred(target)) out.push(target);
    return out;
  }
  if (!stat.isDirectory()) return out;
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const full = join(target, entry.name);
    if (entry.isDirectory()) walkFiles(full, pred, out);
    else if (entry.isFile() && pred(full)) out.push(full);
  }
  return out;
}

function readFrontmatter(file, root, errors) {
  const text = readFileSync(file, "utf8");
  const fm = parseFrontmatter(text);
  if (!fm) {
    errors.push(`${relative(root, file)} is missing frontmatter`);
    return null;
  }
  return fm;
}

function parseFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---")) return null;
  const end = normalized.indexOf("\n---", 3);
  if (end === -1) return null;
  const data = {};
  for (const line of normalized.slice(3, end).split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const splitAt = line.indexOf(":");
    if (splitAt === -1) continue;
    const key = line.slice(0, splitAt).trim();
    let value = line.slice(splitAt + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value === "true") value = true;
    else if (value === "false") value = false;
    if (key) data[key] = value;
  }
  return data;
}

function checkReadme(root, errors) {
  const full = join(root, "README.md");
  if (!existsSync(full)) {
    errors.push("README.md is missing");
    return;
  }
  const text = readFileSync(full, "utf8");
  if (!text.includes("https://www.botopticon.com/privacy")) {
    errors.push("README.md must contain the privacy URL");
  }
  if (!text.includes("support@botopticon.com")) {
    errors.push("README.md must contain support@botopticon.com");
  }
}

function checkBranding(root, errors) {
  for (const file of walkAll(root)) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (text.toLowerCase().includes(BRAND_NEEDLE)) {
      errors.push(`${relative(root, file)} contains disallowed branding`);
    }
  }
}

function walkAll(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkAll(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const invokedDirectly = (process.argv[1] ?? "").endsWith("validate-plugin.mjs");
if (invokedDirectly) {
  const root = process.argv[2] ?? fileURLToPath(new URL("..", import.meta.url));
  const errors = validatePlugin(root);
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`${error}\n`);
    process.exit(1);
  }
  process.stdout.write("validate-plugin: ok\n");
}
