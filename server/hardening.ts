// F-07: Defense-in-depth middleware — CORS, Helmet/CSP, rate limiting.
//
// Extracted into its own module so server/index.ts and integration tests can
// both consume the same configuration without duplicating it.
//
// Boot-time guards (SESSION_SECRET / DATABASE_URL / ALLOWED_ORIGINS) live in
// server/index.ts because they should halt the real server but not unit tests.

import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import cors from "cors";
import type { Request, RequestHandler } from "express";

export function buildAllowedOrigins(rawEnv?: string): string[] {
  const origins = (rawEnv ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  // Dev fallback: allow localhost:5173 when no env var is set.
  if (origins.length === 0) {
    origins.push("http://localhost:5173");
  }
  return origins;
}

export function corsMiddleware(allowedOrigins: string[]): RequestHandler {
  return cors({
    origin: (origin, callback) => {
      // No Origin header = same-origin navigation. Allow.
      if (!origin) return callback(null, true);
      // Listed origin = explicitly allowed cross-origin caller.
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Unlisted origin: omit CORS headers but don't error — the request still
      // reaches the handler. Browsers will block the response for true
      // cross-origin callers; same-origin SPA calls don't need CORS headers.
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
  }) as RequestHandler;
}

export function helmetMiddleware(allowedOrigins: string[]): RequestHandler {
  return helmet({
    frameguard: { action: "deny" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", ...allowedOrigins],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  }) as unknown as RequestHandler;
}

// Auth endpoints: 5 req / min / IP (brute-force guard).
export function authRateLimiter(windowMs = 60_000, max = 5): RequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: "RATE_LIMITED", message: "Too many requests, please try again later." },
    },
  });
}

// All other API endpoints: 60 req / min / session (per-user behind shared edge).
export function apiRateLimiter(windowMs = 60_000, max = 60): RequestHandler {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req: Request) =>
      (req.session as { id?: string } | undefined)?.id ?? ipKeyGenerator(req.ip ?? ""),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: "RATE_LIMITED", message: "Too many requests, please try again later." },
    },
    skip: (req: Request) => req.path === "/health",
  });
}
