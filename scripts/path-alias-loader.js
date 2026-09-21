import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const srcRoot = path.join(projectRoot, "src");

/**
 * Resolve `@/*` → `src/*` (Vite/Next-style alias for plain Node ESM).
 * Node's native package `imports` only allow `#…`, so this loader is required for `@/`.
 *
 * @type {import("node:module").ResolveHook}
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const targetPath = path.resolve(srcRoot, specifier.slice(2));
    return nextResolve(pathToFileURL(targetPath).href, context);
  }

  return nextResolve(specifier, context);
}
