/**
 * Registers the `@/` → `src/` resolve hook for this Node process.
 * Use via: node --import ./scripts/register-path-aliases.js …
 *
 * Also patches CJS `Module._resolveFilename` so drizzle-kit (CJS) can load
 * schema files that import `@/…`.
 */
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(projectRoot, "src");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveWithAtAlias(
  request,
  parent,
  isMain,
  options
) {
  if (typeof request === "string" && request.startsWith("@/")) {
    request = path.join(srcRoot, request.slice(2));
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

register("./path-alias-loader.js", import.meta.url);
