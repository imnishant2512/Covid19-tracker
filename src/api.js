/**
 * Loads the data snapshot generated at build time by scripts/build-data.mjs.
 *
 * See docs/data-source.md for why the figures are built rather than fetched
 * from a live API.
 */

/** Same-origin, so it is unaffected by the CORS limits on the upstream sources. */
const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data/covid-snapshot.json`;

/**
 * @param {AbortSignal} [signal]
 * @returns {Promise<import("./lib/metrics").Snapshot>}
 */
export const fetchSnapshot = async (signal) => {
  const response = await fetch(SNAPSHOT_URL, { signal });

  if (!response.ok) {
    throw new Error(`Could not load the data snapshot (${response.status})`);
  }

  return response.json();
};

/** An abort is a cancellation, not a failure — never surface it to the user. */
export const isAbort = (error) => error?.name === "AbortError";
