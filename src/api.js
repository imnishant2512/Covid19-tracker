const BASE_URL = "https://disease.sh/v3/covid-19";

/**
 * Fetch JSON from the disease.sh API.
 *
 * Throws on non-2xx responses so callers get a real error instead of the API's
 * `{ message: "..." }` body silently flowing through as if it were data — the
 * failure mode that used to leave the UI stuck on a spinner.
 *
 * @param {string} path   path below /v3/covid-19, e.g. "/countries/IN"
 * @param {AbortSignal} [signal]
 */
export const getJSON = async (path, signal) => {
  const response = await fetch(`${BASE_URL}${path}`, { signal });

  if (!response.ok) {
    throw new Error(
      `disease.sh responded ${response.status} for ${path}`
    );
  }

  return response.json();
};

export const fetchWorldwide = (signal) => getJSON("/all", signal);

export const fetchCountries = (signal) => getJSON("/countries", signal);

export const fetchCountry = (countryCode, signal) =>
  getJSON(`/countries/${encodeURIComponent(countryCode)}`, signal);

export const fetchHistorical = (lastDays, signal) =>
  getJSON(`/historical/all?lastdays=${lastDays}`, signal);

/** An abort is a cancellation, not a failure — never surface it to the user. */
export const isAbort = (error) => error?.name === "AbortError";
