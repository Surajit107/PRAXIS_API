/**
 * Frontend (PRAXIS_UI) origin used for email links and OAuth post-login redirects.
 * Set CLIENT_URL once; route paths are composed in application code.
 */
export function getClientBaseUrl() {
  const configured = process.env.CLIENT_URL?.trim();
  return (configured || "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * @param {string} [pathname="/"]
 * @param {Record<string, string | undefined | null>} [query]
 * @returns {string}
 */
export function getClientUrl(pathname = "/", query = {}) {
  const base = getClientBaseUrl();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const url = new URL(`${base}${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

/** Paths the API expects to exist on CLIENT_URL. */
export const CLIENT_PATHS = Object.freeze({
  profile: "/user/profile",
  forgotPassword: "/forgot-password",
  verifyEmail: "/verify-email",
});
