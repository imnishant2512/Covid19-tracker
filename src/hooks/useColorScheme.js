import { useEffect, useState } from "react";

const QUERY = "(prefers-color-scheme: dark)";

/**
 * The viewer's colour scheme, kept live so the chart recolours if they change
 * the system setting while the page is open.
 *
 * CSS handles this on its own through media queries; this exists only for the
 * canvas-based chart, which takes colour values rather than stylesheets.
 *
 * @returns {"light"|"dark"}
 */
export const useColorScheme = () => {
  const [scheme, setScheme] = useState(
    /** @returns {"light"|"dark"} */ () =>
      typeof window !== "undefined" && window.matchMedia?.(QUERY).matches
        ? "dark"
        : "light"
  );

  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return undefined;

    const onChange = (event) => setScheme(event.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return scheme;
};
