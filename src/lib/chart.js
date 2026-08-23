import { METRICS } from "./metrics";

/**
 * Turn the weekly [date, newCases, newDeaths] tuples into chart points.
 *
 * The series is already per-week new counts, so no differencing is needed. The
 * previous data source gave cumulative totals that had to be differenced, which
 * is where the old NaN points came from.
 */
export const buildChartData = (weeks, metric) => {
  if (!Array.isArray(weeks)) return [];
  const { weekIndex } = METRICS[metric];

  return weeks.map((week) => ({ x: week[0], y: week[weekIndex] ?? 0 }));
};

/** The snapshot ships ISO dates; Chart.js's time scale wants timestamps. */
export const toTimestamp = (isoDate) => new Date(`${isoDate}T00:00:00Z`).getTime();
