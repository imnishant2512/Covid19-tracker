import numeral from "numeral";

export const WORLDWIDE = "worldwide";

/** Leaflet's default world view, used whenever no single country is selected. */
export const WORLD_VIEW = { center: [20, 10], zoom: 2 };

export const COUNTRY_ZOOM = 4;

/**
 * The metrics the app can display.
 *
 * WHO publishes no recovery figures, so the original "Recovered" metric has no
 * source and is replaced by newly reported cases, which is the only genuinely
 * current signal in the data.
 *
 * `field` is the per-country key; `weekIndex` is the position in a
 * [date, newCases, newDeaths] tuple from the weekly series.
 */
export const METRICS = {
  cases: {
    label: "Coronavirus Cases",
    field: "cases",
    cumulative: true,
    hex: "#cc1034",
    multiplier: 800,
    weekIndex: 1,
  },
  newCases: {
    label: "New Cases",
    field: "newCases",
    cumulative: false,
    hex: "#f2a900",
    multiplier: 6000,
    weekIndex: 1,
  },
  deaths: {
    label: "Deaths",
    field: "deaths",
    cumulative: true,
    hex: "#6c757d",
    multiplier: 2000,
    weekIndex: 2,
  },
};

export const METRIC_KEYS = Object.keys(METRICS);

/** "#cc1034" -> "rgba(204, 16, 52, 0.5)", for chart fills derived from the palette. */
export const withAlpha = (hex, alpha) => {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Sort a copy of the country list by a metric, descending. */
export const sortByMetric = (data, metric) =>
  [...data].sort((a, b) => (b[METRICS[metric].field] ?? 0) - (a[METRICS[metric].field] ?? 0));

/** "1.2m" for large figures; "0" for null/undefined/0. */
export const prettyPrintStat = (stat) =>
  stat ? numeral(stat).format("0.0a") : "0";

/** "1,234,567" — no zero padding. */
export const formatNumber = (value) => numeral(value ?? 0).format("0,0");

/** Circle radius in metres, scaled so small and large countries stay legible. */
export const circleRadius = (country, metric) => {
  const { field, multiplier } = METRICS[metric];
  return Math.sqrt(Math.max(country[field] ?? 0, 0) / 10) * multiplier;
};

/**
 * Turn the weekly [date, newCases, newDeaths] tuples into chart points for one
 * metric. The series is already per-week new counts, so no differencing is
 * needed — the previous data source gave cumulative totals and had to be
 * differenced, which is where the old NaN bugs came from.
 */
export const buildChartData = (weeks, metric) => {
  if (!Array.isArray(weeks)) return [];
  const { weekIndex } = METRICS[metric];

  return weeks.map((week) => ({ x: week[0], y: week[weekIndex] ?? 0 }));
};
