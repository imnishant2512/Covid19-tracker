import { useEffect, useState } from "react";
import { fetchHistory, fetchSnapshot, isAbort } from "../api";

/**
 * Loads one resource once and reports load state.
 *
 * Kept out of App so the component is about layout rather than about fetching,
 * and so the loading and abort behaviour can be tested without rendering the
 * whole dashboard.
 *
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} fetcher Must be stable: it is
 *   called once, on mount.
 * @returns {{data: T|null, error: Error|null, isLoading: boolean}}
 */
const useFetched = (fetcher) => {
  const [data, setData] = useState(/** @type {T|null} */ (null));
  const [error, setError] = useState(/** @type {Error|null} */ (null));

  useEffect(() => {
    const controller = new AbortController();

    fetcher(controller.signal)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => {
        // An abort is a cancellation, not a failure: surfacing it would flash
        // an error banner every time the component unmounted mid-flight.
        if (isAbort(err)) return;
        setError(err);
      });

    return () => controller.abort();
  }, [fetcher]);

  return { data, error, isLoading: data === null && error === null };
};

/**
 * The data snapshot: totals, countries and the worldwide weekly series.
 *
 * @returns {{snapshot: import("../lib/metrics").Snapshot|null, error: Error|null, isLoading: boolean}}
 */
export const useSnapshot = () => {
  const { data, error, isLoading } = useFetched(fetchSnapshot);
  return { snapshot: data, error, isLoading };
};

/**
 * Each country's weekly figures. Requested alongside the snapshot rather than
 * after it, so it is usually there by the time anyone opens the date filter.
 *
 * @returns {{history: import("../lib/range").History|null, error: Error|null, isLoading: boolean}}
 */
export const useHistory = () => {
  const { data, error, isLoading } = useFetched(fetchHistory);
  return { history: data, error, isLoading };
};
