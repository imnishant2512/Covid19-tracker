import { useEffect, useState } from "react";
import { fetchSnapshot, isAbort } from "../api";

/**
 * Loads the data snapshot once and reports load state.
 *
 * Kept out of App so the component is about layout rather than about fetching,
 * and so the loading and abort behaviour can be tested without rendering the
 * whole dashboard.
 *
 * @returns {{snapshot: object|null, error: Error|null, isLoading: boolean}}
 */
export const useSnapshot = () => {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchSnapshot(controller.signal)
      .then((data) => {
        setSnapshot(data);
        setError(null);
      })
      .catch((err) => {
        // An abort is a cancellation, not a failure: surfacing it would flash
        // an error banner every time the component unmounted mid-flight.
        if (isAbort(err)) return;
        setError(err);
      });

    return () => controller.abort();
  }, []);

  return { snapshot, error, isLoading: snapshot === null && error === null };
};
