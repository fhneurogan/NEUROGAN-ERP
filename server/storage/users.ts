import type { UserRole } from "@shared/schema";

// Pure helpers for the users storage layer (see server/db-storage.ts for the
// persistence methods themselves). Kept separate so the logic is directly
// unit-testable without a database.

// Compute which roles to grant and which to revoke to move a user from the
// `current` set to the `next` set. Order-independent, idempotent (calling
// twice with the same inputs gives the same deltas), and resilient to
// duplicates inside either list.
export function computeRoleDelta(
  current: readonly UserRole[],
  next: readonly UserRole[],
): { add: UserRole[]; remove: UserRole[] } {
  const currentSet = new Set(current);
  const nextSet = new Set(next);

  const add: UserRole[] = [];
  for (const role of nextSet) {
    if (!currentSet.has(role)) add.push(role);
  }

  const remove: UserRole[] = [];
  for (const role of currentSet) {
    if (!nextSet.has(role)) remove.push(role);
  }

  // Sort so tests and audit rows see a stable order.
  add.sort();
  remove.sort();
  return { add, remove };
}
