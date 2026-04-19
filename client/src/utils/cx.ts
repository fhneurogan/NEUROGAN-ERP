import { extendTailwindMerge } from "tailwind-merge";

export const cx = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display-xs", "display-sm", "display-md", "display-lg", "display-xl", "display-2xl"],
    },
  },
});

export function sortCx<T extends Record<string, string | number | Record<string, string | number | Record<string, string | number>>>>(classes: T): T {
  return classes;
}
