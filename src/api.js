/**
 * The app reads a snapshot generated at build time by scripts/build-data.mjs
 * rather than calling a COVID API at runtime.
 *
 * No public API is currently both accurate and reachable from a browser: the
 * CORS-friendly ones (disease.sh) froze when their upstreams stopped publishing
 * in 2023, and the current ones (WHO, Our World in Data) are either CORS-blocked
 * or only available as multi-megabyte bulk files. Aggregating at build time
 * gives correct WHO figures in a 40KB same-origin file.
 */
const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data/covid-snapshot.json`;

export const fetchSnapshot = async (signal) => {
  const response = await fetch(SNAPSHOT_URL, { signal });

  if (!response.ok) {
    throw new Error(`Could not load the data snapshot (${response.status})`);
  }

  return response.json();
};

/** An abort is a cancellation, not a failure — never surface it to the user. */
export const isAbort = (error) => error?.name === "AbortError";
