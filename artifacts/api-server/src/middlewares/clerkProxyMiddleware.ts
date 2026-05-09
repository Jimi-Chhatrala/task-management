/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - In development, proxies to the instance-specific dev FAPI (decoded from pk_test_ key)
 * - In production, proxies to frontend-api.clerk.dev with Clerk-Proxy-Url header
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler } from "express";
import type { IncomingHttpHeaders } from "http";

const CLERK_PROD_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

/**
 * Decodes the instance-specific Frontend API URL from a Clerk publishable key.
 * Format: pk_test_<base64(fapi_host$)> or pk_live_<base64(fapi_host$)>
 */
function fapiFromPublishableKey(key: string): string {
  const inner = key.replace(/^pk_(test|live)_/, "");
  const decoded = Buffer.from(inner, "base64").toString("utf-8");
  // Strip trailing $ sentinel included in the encoded payload
  return decoded.replace(/\$$/, "");
}

/**
 * Returns the first effective public hostname for the given request,
 * preferring x-forwarded-host over the Host header so callers behind a
 * proxy see the original client-facing host.
 *
 * x-forwarded-host can take three shapes:
 *   - undefined (no proxy involved)
 *   - a single string (one proxy hop)
 *   - a comma-delimited string when an upstream appended rather than
 *     replaced the header (Node folds duplicate headers this way), or a
 *     string[] in some Express typings
 * In the multi-value case, the leftmost value is the original client-
 * facing host. Take that one in all forms. Exported so that app.ts
 * (clerkMiddleware callback) and this proxy middleware agree on which
 * hostname is canonical — otherwise multi-domain/custom-domain flows
 * break.
 */
export function getClerkProxyHost(req: {
  headers: IncomingHttpHeaders;
}): string | undefined {
  const forwarded = req.headers["x-forwarded-host"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstHop = raw?.split(",")[0]?.trim();
  return firstHop || req.headers.host?.trim() || undefined;
}

export function clerkProxyMiddleware(): RequestHandler {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!publishableKey) {
    return (_req, _res, next) => next();
  }

  const isProduction = process.env.NODE_ENV === "production";

  // In dev, proxy to the instance-specific FAPI (decoded from pk_test_ key).
  // In prod, proxy to frontend-api.clerk.dev with the Clerk-Proxy-Url header.
  const fapiHost = isProduction
    ? new URL(CLERK_PROD_FAPI).host
    : fapiFromPublishableKey(publishableKey);
  const target = `https://${fapiHost}`;

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    followRedirects: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq, req) => {
        // Clerk-Proxy-Url and secret key headers are only needed in production.
        // Dev instances don't support proxy mode — they just need traffic
        // forwarded to their instance-specific FAPI without extra headers.
        if (isProduction && secretKey) {
          const protocol = req.headers["x-forwarded-proto"] || "https";
          const host = getClerkProxyHost(req) || "";
          const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

          proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
          proxyReq.setHeader("Clerk-Secret-Key", secretKey);

          const xff = req.headers["x-forwarded-for"];
          const clientIp =
            (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
            req.socket?.remoteAddress ||
            "";
          if (clientIp) {
            proxyReq.setHeader("X-Forwarded-For", clientIp);
          }
        }
      },
    },
  }) as RequestHandler;
}
