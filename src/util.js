import numeral from "numeral";

export const WORLDWIDE = "worldwide";

/** Leaflet's default world view, used whenever no single country is selected. */
export const WORLD_VIEW = { center: [20, 10], zoom: 2 };

export const COUNTRY_ZOOM = 4;

export const casesTypeColors = {
  cases: {
    hex: "#cc1034",
    multiplier: 800,
  },
  recovered: {
    hex: "#7dd71d",
    multiplier: 1200,
  },
  deaths: {
    hex: "#c0c0c0",
    multiplier: 2000,
  },
};

/** "#cc1034" -> "rgba(204, 16, 52, 0.5)", for chart fills derived from the palette. */
export const withAlpha = (hex, alpha) => {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Sort a copy of the country list by total cases, descending. */
export const sortData = (data) => [...data].sort((a, b) => b.cases - a.cases);

/** "+1.2m" for the today-delta figures; "+0" for null/undefined/0. */
export const prettyPrintStat = (stat) =>
  stat ? `+${numeral(stat).format("0.0a")}` : "+0";

/** "1,234,567" — no zero padding. */
export const formatNumber = (value) => numeral(value ?? 0).format("0,0");

/** Circle radius in metres, scaled so small and large countries stay legible. */
export const circleRadius = (country, casesType) =>
  Math.sqrt(Math.max(country[casesType] ?? 0, 0) / 10) *
  casesTypeColors[casesType].multiplier;

/**
 * Turn a cumulative {date: total} series into day-over-day deltas.
 *
 * Iterates the *selected* series rather than `data.cases`, so a series with a
 * different set of dates can't silently produce NaN points.
 */
export const buildChartData = (data, casesType) => {
  const series = data?.[casesType];
  if (!series) return [];

  const chartData = [];
  let lastDataPoint;

  for (const date in series) {
    if (lastDataPoint !== undefined) {
      chartData.push({ x: date, y: series[date] - lastDataPoint });
    }
    lastDataPoint = series[date];
  }

  return chartData;
};
