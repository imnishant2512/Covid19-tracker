import { palette } from "../theme";

export const WORLDWIDE = "worldwide";

/**
 * Leaflet's default world view, used whenever no single country is selected.
 * The centre is a tuple rather than an array so it satisfies Leaflet's
 * LatLngExpression without a cast at each call site.
 *
 * @type {{ center: [number, number], zoom: number }}
 */
export const WORLD_VIEW = { center: [20, 10], zoom: 2 };

export const COUNTRY_ZOOM = 4;

/**
 * The metrics the app can display.
 *
 * WHO publishes no recovery figures, so the original "Recovered" metric has no
 * source and is replaced by newly reported cases, which is the only genuinely
 * current signal in the data. See docs/data-source.md.
 *
 * `field` is the per-country key; `weekIndex` is the position in a
 * [date, newCases, newDeaths] tuple from the weekly series.
 */
export const METRICS = {
  cases: {
    label: "Coronavirus Cases",
    field: "cases",
    cumulative: true,
    hex: palette.cases,
    multiplier: 800,
    weekIndex: 1,
  },
  newCases: {
    label: "New Cases",
    field: "newCases",
    cumulative: false,
    hex: palette.newCases,
    multiplier: 6000,
    weekIndex: 1,
  },
  deaths: {
    label: "Deaths",
    field: "deaths",
    cumulative: true,
    hex: palette.deaths,
    multiplier: 2000,
    weekIndex: 2,
  },
};

/** @typedef {keyof typeof METRICS} MetricKey */
/**
 * A country row from the snapshot.
 * @typedef {{code: string, name: string, lat: number, long: number, flag: string,
 *   cases: number, deaths: number, newCases: number, newDeaths: number}} Country
 */
/**
 * The generated data snapshot the app loads at runtime.
 * @typedef {{updated: string, source: string, sourceUrl: string, generatedAt: string,
 *   global: {cases: number, deaths: number, newCases: number, newDeaths: number},
 *   countries: Country[], weeks: Array<[string, number, number]>}} Snapshot
 */

export const METRIC_KEYS = /** @type {MetricKey[]} */ (Object.keys(METRICS));

/**
 * Sort a copy of the country list by a metric, descending.
 *
 * @template {Record<string, any>} T
 * @param {T[]} data
 * @param {MetricKey} metric
 * @returns {T[]}
 */
export const sortByMetric = (data, metric) =>
  [...data].sort(
    (a, b) => (b[METRICS[metric].field] ?? 0) - (a[METRICS[metric].field] ?? 0)
  );

/**
 * Circle radius in metres, scaled so small and large countries stay legible.
 *
 * @param {Record<string, any>} country
 * @param {MetricKey} metric
 */
export const circleRadius = (country, metric) => {
  const { field, multiplier } = METRICS[metric];
  return Math.sqrt(Math.max(country[field] ?? 0, 0) / 10) * multiplier;
};
