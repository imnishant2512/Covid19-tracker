import { useCallback, useEffect, useState } from "react";

/** @typedef {import("../lib/range").RangeQuery} RangeQuery */

const KEYS = /** @type {const} */ (["period", "from", "to"]);

/** @returns {RangeQuery} */
const readQuery = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    period: params.get("period"),
    from: params.get("from"),
    to: params.get("to"),
  };
};

/**
 * The date filter's state, kept in the page URL so a filtered view survives a
 * reload and can be bookmarked or shared.
 *
 * The URL is replaced rather than pushed: changing a filter is not navigation,
 * and pushing would make Back step through every adjustment. Parameters that
 * belong to anything else are left alone.
 *
 * @returns {[RangeQuery, (next: RangeQuery) => void]}
 */
export const useRangeQuery = () => {
  const [query, setQuery] = useState(readQuery);

  const update = useCallback((/** @type {RangeQuery} */ next) => {
    const url = new URL(window.location.href);
    for (const key of KEYS) {
      const value = next[key];
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }

    window.history.replaceState(window.history.state, "", url);
    setQuery(readQuery());
  }, []);

  // Back and Forward can still land on a URL with a different range, e.g. one
  // opened from a shared link earlier in the session.
  useEffect(() => {
    const onPopState = () => setQuery(readQuery());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return [query, update];
};
