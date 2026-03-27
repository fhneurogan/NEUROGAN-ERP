import { useSyncExternalStore, useCallback } from "react";

/**
 * Custom hash location hook for wouter that supports query params in the hash.
 *
 * Standard useHashLocation splits "?params" out of the hash and puts them in url.search.
 * This hook keeps them in the hash so that pages can read them from window.location.hash.
 * Route matching only uses the path portion (before "?").
 *
 * URL format: /#/inventory?material=prod-162
 * Route matching sees: /inventory
 * Pages read params from: window.location.hash → "#/inventory?material=prod-162"
 */

// Listeners for hash changes
const listeners: { v: Array<() => void> } = { v: [] };

const onHashChange = () => listeners.v.forEach((cb) => cb());

const subscribeToHashUpdates = (callback: () => void) => {
  if (listeners.v.push(callback) === 1)
    addEventListener("hashchange", onHashChange);

  return () => {
    listeners.v = listeners.v.filter((i) => i !== callback);
    if (!listeners.v.length) removeEventListener("hashchange", onHashChange);
  };
};

// Get just the path portion of the hash (no query params) for route matching
function currentHashPath(): string {
  const raw = "/" + location.hash.replace(/^#?\/?/, "");
  const qIndex = raw.indexOf("?");
  return qIndex >= 0 ? raw.substring(0, qIndex) : raw;
}

// Navigate: put everything (path + query) into the hash
function navigateHash(to: string, { state = null, replace = false }: { state?: any; replace?: boolean } = {}) {
  const oldURL = location.href;

  // Clean the path and keep query params together in the hash
  const cleanTo = to.replace(/^#?\/?/, "");
  const newHash = "#/" + cleanTo;

  // Build the new URL preserving existing search params from the real URL
  const url = new URL(location.href);
  url.hash = "/" + cleanTo;
  // Clear any stale search params that wouter's default navigate may have put in url.search
  url.search = "";
  const newURL = url.href;

  if (replace) {
    history.replaceState(state, "", newURL);
  } else {
    history.pushState(state, "", newURL);
  }

  const event =
    typeof HashChangeEvent !== "undefined"
      ? new HashChangeEvent("hashchange", { oldURL, newURL })
      : new Event("hashchange");

  dispatchEvent(event);
}

export function useHashLocationWithParams({ ssrPath = "/" } = {}): [string, typeof navigateHash] {
  const path = useSyncExternalStore(
    subscribeToHashUpdates,
    currentHashPath,
    () => ssrPath
  );
  return [path, navigateHash];
}

// Tell wouter how to format href attributes
(useHashLocationWithParams as any).hrefs = (href: string) => "#" + href;
