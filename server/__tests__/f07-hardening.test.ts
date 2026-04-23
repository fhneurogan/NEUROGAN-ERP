// F-07: Hardening — CORS, rate-limit, request-id, helmet.
//
// Unit tests exercise the middleware factories directly (no DB needed).
// Integration tests (skipped without DATABASE_URL) hit a real running server.

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "crypto";
import {
  buildAllowedOrigins,
  corsMiddleware,
  authRateLimiter,
  apiRateLimiter,
  helmetMiddleware,
} from "../hardening";

// ---------------------------------------------------------------------------
// buildAllowedOrigins — pure unit tests, no network needed
// ---------------------------------------------------------------------------
describe("buildAllowedOrigins", () => {
  it("returns localhost:5173 when env var is empty", () => {
    expect(buildAllowedOrigins("")).toEqual(["http://localhost:5173"]);
    expect(buildAllowedOrigins(undefined)).toEqual(["http://localhost:5173"]);
  });

  it("parses a single origin", () => {
    expect(buildAllowedOrigins("https://app.railway.app")).toEqual(["https://app.railway.app"]);
  });

  it("parses multiple comma-separated origins", () => {
    const result = buildAllowedOrigins("https://a.com, https://b.com");
    expect(result).toEqual(["https://a.com", "https://b.com"]);
  });

  it("strips empty segments from the comma list", () => {
    const result = buildAllowedOrigins(",https://a.com,,");
    expect(result).toEqual(["https://a.com"]);
  });
});

// ---------------------------------------------------------------------------
// CORS middleware — rejects wrong origins, allows listed ones
// ---------------------------------------------------------------------------
describe("CORS middleware", () => {
  const allowed = ["https://app.example.com"];

  function buildApp() {
    const app = express();
    app.use(corsMiddleware(allowed));
    app.get("/api/health", (_req, res) => res.json({ ok: true }));
    return app;
  }

  it("allows a listed origin", async () => {
    const res = await request(buildApp())
      .get("/api/health")
      .set("Origin", "https://app.example.com");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://app.example.com");
  });

  it("rejects an unlisted origin with 500 (cors default for blocked origins)", async () => {
    const res = await request(buildApp())
      .get("/api/health")
      .set("Origin", "https://evil.com");
    // cors() calls next(err) for blocked origins; without error handler Express returns 500
    expect(res.status).toBe(500);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows same-origin requests (no Origin header)", async () => {
    const res = await request(buildApp()).get("/api/health");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Helmet middleware — checks key security headers
// ---------------------------------------------------------------------------
describe("Helmet middleware", () => {
  function buildApp() {
    const app = express();
    app.use(helmetMiddleware(["https://app.example.com"]));
    app.get("/", (_req, res) => res.json({ ok: true }));
    return app;
  }

  it("sets X-Frame-Options: DENY", async () => {
    const res = await request(buildApp()).get("/");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });

  it("sets Content-Security-Policy header", async () => {
    const res = await request(buildApp()).get("/");
    expect(res.headers["content-security-policy"]).toMatch(/default-src 'self'/);
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const res = await request(buildApp()).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});

// ---------------------------------------------------------------------------
// Auth rate limiter — 5 req / min; 6th returns 429
// ---------------------------------------------------------------------------
describe("Auth rate limiter", () => {
  function buildApp() {
    const app = express();
    // windowMs=100ms so tests don't have to wait a real minute
    app.use("/api/auth", authRateLimiter(100, 5));
    app.post("/api/auth/login", (_req, res) => res.json({ ok: true }));
    return app;
  }

  it("allows the first 5 requests", async () => {
    const app = buildApp();
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/api/auth/login");
      expect(res.status).toBe(200);
    }
  });

  it("blocks the 6th request with 429", async () => {
    const app = buildApp();
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login");
    }
    const res = await request(app).post("/api/auth/login");
    expect(res.status).toBe(429);
    expect(res.body?.error?.code).toBe("RATE_LIMITED");
  });
});

// ---------------------------------------------------------------------------
// API rate limiter — skips /health, limits everything else
// ---------------------------------------------------------------------------
describe("API rate limiter", () => {
  function buildApp(max: number) {
    const app = express();
    app.use("/api", apiRateLimiter(100, max));
    app.get("/api/health", (_req, res) => res.json({ ok: true }));
    app.get("/api/data", (_req, res) => res.json({ ok: true }));
    return app;
  }

  it("never rate-limits /api/health", async () => {
    const app = buildApp(1); // max=1 — anything else would be limited
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
    }
  });

  it("blocks when limit is exceeded", async () => {
    const app = buildApp(2);
    await request(app).get("/api/data");
    await request(app).get("/api/data");
    const res = await request(app).get("/api/data");
    expect(res.status).toBe(429);
    expect(res.body?.error?.code).toBe("RATE_LIMITED");
  });
});

// ---------------------------------------------------------------------------
// Request-ID round-trip (integration — skipped without DATABASE_URL)
// ---------------------------------------------------------------------------
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("integration: request-id", () => {
  it("attaches X-Request-Id to error responses", async () => {
    // The real server adds req.requestId = randomUUID(). The test-app helper
    // does the same, so we can use it here to verify round-trip behaviour.
    const { buildTestApp } = await import("./helpers/test-app");
    const app = await buildTestApp();

    // Request to an endpoint that doesn't exist → 404 from the error middleware.
    // The error middleware echoes req.requestId as X-Request-Id.
    const res = await request(app)
      .get(`/api/nonexistent-${randomUUID()}`)
      .set("X-Test-User-Id", "any");

    // 401 is fine too (no real user), as long as X-Request-Id header is present.
    expect(res.headers["x-request-id"] ?? res.headers["x-request-id"]).toBeDefined();
  });
});
