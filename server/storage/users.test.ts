import { describe, it, expect } from "vitest";
import { computeRoleDelta } from "./users";
import type { UserRole } from "@shared/schema";

describe("computeRoleDelta", () => {
  it("returns empty deltas when current equals next", () => {
    const delta = computeRoleDelta(["ADMIN", "QA"], ["ADMIN", "QA"]);
    expect(delta).toEqual({ add: [], remove: [] });
  });

  it("returns empty deltas when inputs are order-swapped", () => {
    const delta = computeRoleDelta(["QA", "ADMIN"], ["ADMIN", "QA"]);
    expect(delta).toEqual({ add: [], remove: [] });
  });

  it("returns added roles when next is a superset", () => {
    const delta = computeRoleDelta(["QA"], ["ADMIN", "QA", "PRODUCTION"]);
    expect(delta).toEqual({ add: ["ADMIN", "PRODUCTION"], remove: [] });
  });

  it("returns removed roles when next is a subset", () => {
    const delta = computeRoleDelta(["ADMIN", "QA", "PRODUCTION"], ["QA"]);
    expect(delta).toEqual({ add: [], remove: ["ADMIN", "PRODUCTION"] });
  });

  it("returns both adds and removes when sets diverge", () => {
    const delta = computeRoleDelta(["ADMIN", "QA"], ["PRODUCTION", "QA"]);
    expect(delta).toEqual({ add: ["PRODUCTION"], remove: ["ADMIN"] });
  });

  it("handles completely disjoint sets", () => {
    const delta = computeRoleDelta(["ADMIN"], ["VIEWER"]);
    expect(delta).toEqual({ add: ["VIEWER"], remove: ["ADMIN"] });
  });

  it("is idempotent — calling twice with same inputs gives same result", () => {
    const current: UserRole[] = ["ADMIN", "QA"];
    const next: UserRole[] = ["QA", "PRODUCTION"];
    expect(computeRoleDelta(current, next)).toEqual(computeRoleDelta(current, next));
  });

  it("applying delta forward then back yields empty-delta round-trip", () => {
    const current: UserRole[] = ["ADMIN", "VIEWER"];
    const next: UserRole[] = ["QA", "PRODUCTION"];
    const forward = computeRoleDelta(current, next);
    const back = computeRoleDelta(next, current);
    expect(forward.add).toEqual(back.remove);
    expect(forward.remove).toEqual(back.add);
  });

  it("deduplicates repeated roles inside either input", () => {
    const delta = computeRoleDelta(
      ["ADMIN", "ADMIN", "QA"] as UserRole[],
      ["QA", "QA", "PRODUCTION"] as UserRole[],
    );
    expect(delta).toEqual({ add: ["PRODUCTION"], remove: ["ADMIN"] });
  });

  it("returns empty arrays for two empty inputs", () => {
    const delta = computeRoleDelta([], []);
    expect(delta).toEqual({ add: [], remove: [] });
  });

  it("returns full next in add when current is empty", () => {
    const delta = computeRoleDelta([], ["ADMIN", "QA"]);
    expect(delta).toEqual({ add: ["ADMIN", "QA"], remove: [] });
  });

  it("returns full current in remove when next is empty", () => {
    const delta = computeRoleDelta(["ADMIN", "QA"], []);
    expect(delta).toEqual({ add: [], remove: ["ADMIN", "QA"] });
  });
});
