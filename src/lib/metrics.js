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
    weekIndex: 1,
  },
  newCases: {
    label: "New Cases",
    field: "newCases",
    cumulative: false,
    hex: palette.newCases,
    weekIndex: 1,
  },
  deaths: {
    label: "Deaths",
    field: "deaths",
    cumulative: true,
    hex: palette.deaths,
    weekIndex: 2,
  },
};

/** @typedef {keyof typeof METRICS} MetricKey */
/**
 * A country row from the snapshot. `lat`, `long` and `flag` are null for the
 * few WHO territories the geometry source does not cover.
 * @typedef {{code: string, name: string, lat: number|null, long: number|null,
 *   flag: string|null, cases: number, deaths: number, newCases: number,
 *   newDeaths: number}} Country
 */

/**
 * Can this country be placed on the map?
 *
 * @param {{lat?: number|null, long?: number|null}} country
 */
export const hasCoordinates = (country) =>
  Number.isFinite(country.lat) && Number.isFinite(country.long);
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

/** Radius, in metres, of the largest circle on the map. */
export const MAX_RADIUS = 2_000_000;

/**
 * Circle radius in metres. Area is proportional to the value, and the largest
 * value in view is drawn at MAX_RADIUS.
 *
 * Scaling to the largest value, rather than by a fixed multiplier per metric,
 * is what lets the date filter work: a fixed multiplier tuned for all-time
 * totals drew a three-month period as dots too small to see.
 *
 * @param {number|null|undefined} value
 * @param {number} max The largest value among the circles being drawn.
 */
export const circleRadius = (value, max) =>
  max > 0 ? Math.sqrt(Math.max(value ?? 0, 0) / max) * MAX_RADIUS : 0;
