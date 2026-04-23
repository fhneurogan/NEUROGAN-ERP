import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, generateTemporaryPassword } from "./password";

describe("hashPassword", () => {
  it("produces an argon2id hash prefixed with $argon2id$", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-Staple-1!");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("produces different hashes for the same password (salt is random)", async () => {
    const hash1 = await hashPassword("same-input");
    const hash2 = await hashPassword("same-input");
    expect(hash1).not.toBe(hash2);
  });

  it("throws on empty string", async () => {
    await expect(hashPassword("")).rejects.toThrow("plain must be a non-empty string");
  });
});

describe("verifyPassword", () => {
  it("returns true for the matching plaintext", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-Staple-1!");
    expect(await verifyPassword(hash, "Correct-Horse-Battery-Staple-1!")).toBe(true);
  });

  it("returns false for a non-matching plaintext", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-Staple-1!");
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });

  it("returns false for a malformed hash (does not throw)", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });

  it("returns false for an empty hash (does not throw)", async () => {
    expect(await verifyPassword("", "anything")).toBe(false);
  });
});

describe("generateTemporaryPassword", () => {
  it("returns at least 12 chars (D-02 minimum policy)", () => {
    const pw = generateTemporaryPassword();
    expect(pw.length).toBeGreaterThanOrEqual(12);
  });

  it("is URL-safe (base64url) — no +, /, =, whitespace", () => {
    for (let i = 0; i < 20; i++) {
      const pw = generateTemporaryPassword();
      expect(pw).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("is not predictable — consecutive calls produce different values", () => {
    const a = generateTemporaryPassword();
    const b = generateTemporaryPassword();
    expect(a).not.toBe(b);
  });
});
