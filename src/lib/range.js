/**
 * The date filter: which weeks are in view, and the figures for them.
 *
 * WHO reports weekly, so a range is always a run of whole reporting weeks
 * taken from the snapshot's own list of dates, never arbitrary days. With no
 * range the dashboard shows all-time totals, as it always has.
 */

/**
 * @typedef {{id: string, label: string, weeks: number}} Preset
 * @typedef {{from: string, to: string, startIndex: number, endIndex: number,
 *   preset: string|null}} Range
 *   Inclusive indices into the week list. `preset` is set when the range came
 *   from one, so the control and the URL can say "last 3 months" rather than
 *   two dates.
 * @typedef {{period?: string|null, from?: string|null, to?: string|null}} RangeQuery
 *   What the URL carries: a preset id, or an explicit pair of dates.
 */

/** @type {Preset[]} */
export const PRESETS = [
  { id: "4w", label: "Last 4 weeks", weeks: 4 },
  { id: "3m", label: "Last 3 months", weeks: 13 },
  { id: "6m", label: "Last 6 months", weeks: 26 },
  { id: "1y", label: "Last year", weeks: 52 },
];

export const ALL_TIME = "all";
export const CUSTOM = "custom";

/**
 * Resolve what the URL asked for against the weeks that actually exist.
 *
 * Presets are relative, so a bookmarked "last 3 months" stays current as new
 * weeks arrive. Explicit dates are snapped inward to the nearest reporting
 * week, swapped if given backwards, and clamped to the data; anything that
 * cannot be made sense of falls back to all time rather than to an error.
 *
 * @param {RangeQuery} query
 * @param {string[]} weeks ISO dates, ascending
 * @returns {Range|null} null for all time
 */
export const resolveRange = (query, weeks) => {
  if (weeks.length === 0) return null;
  const last = weeks.length - 1;

  const preset = PRESETS.find((p) => p.id === query.period);
  if (preset) {
    const startIndex = Math.max(0, weeks.length - preset.weeks);
    return {
      from: weeks[startIndex],
      to: weeks[last],
      startIndex,
      endIndex: last,
      preset: preset.id,
    };
  }

  const isDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  let from = isDate(query.from) ? query.from : null;
  let to = isDate(query.to) ? query.to : null;
  if (!from && !to) return null;
  if (from && to && from > to) [from, to] = [to, from];

  // First week on or after `from`; last week on or before `to`.
  let startIndex = from ? weeks.findIndex((week) => week >= from) : 0;
  let endIndex = last;
  if (to) {
    endIndex = -1;
    for (let i = last; i >= 0; i -= 1) {
      if (weeks[i] <= to) {
        endIndex = i;
        break;
      }
    }
  }

  // Entirely outside the data: clamp to the nearest end rather than show nothing.
  if (startIndex === -1) startIndex = last;
  if (endIndex === -1) endIndex = 0;
  if (startIndex > endIndex) [startIndex, endIndex] = [endIndex, startIndex];

  return {
    from: weeks[startIndex],
    to: weeks[endIndex],
    startIndex,
    endIndex,
    preset: null,
  };
};

/**
 * The URL parameters that describe a range. Inverse of resolveRange.
 *
 * @param {Range|null} range
 * @returns {RangeQuery}
 */
export const toQuery = (range) => {
  if (!range) return {};
  if (range.preset) return { period: range.preset };
  return { from: range.from, to: range.to };
};

/**
 * Sum a slice of a weekly array, inclusive.
 *
 * @param {number[]|undefined} values
 * @param {number} start
 * @param {number} end
 */
const sumRange = (values, start, end) => {
  let total = 0;
  for (let i = start; i <= end; i += 1) total += values?.[i] ?? 0;
  return total;
};

/**
 * Worldwide figures for a range, from the snapshot's global weekly series.
 *
 * Cases and deaths become the totals reported within the range; new cases and
 * new deaths become those of its final week, so each card still answers the
 * question it answers in the all-time view.
 *
 * @param {Array<[string, number, number]>} weeks
 * @param {Range} range
 */
export const globalForRange = (weeks, { startIndex, endIndex }) => {
  let cases = 0;
  let deaths = 0;
  for (let i = startIndex; i <= endIndex; i += 1) {
    cases += weeks[i]?.[1] ?? 0;
    deaths += weeks[i]?.[2] ?? 0;
  }

  return {
    cases,
    deaths,
    newCases: weeks[endIndex]?.[1] ?? 0,
    newDeaths: weeks[endIndex]?.[2] ?? 0,
  };
};

/**
 * @typedef {{weeks: string[], countries: Record<string, [number[], number[]]>}} History
 */

/**
 * Per-country figures for a range, with the same meaning as globalForRange.
 *
 * Indices are looked up by date in the history's own week list rather than
 * assumed to match the snapshot's, so a history from a different build can
 * never silently shift every figure by a week.
 *
 * @template {{code: string}} T
 * @param {T[]} countries
 * @param {History} history
 * @param {Range} range
 * @returns {Array<T & {cases: number, deaths: number, newCases: number, newDeaths: number}>}
 */
export const countriesForRange = (countries, history, range) => {
  const start = history.weeks.indexOf(range.from);
  const end = history.weeks.indexOf(range.to);
  if (start === -1 || end === -1) return [];

  return countries.map((country) => {
    const [newCases, newDeaths] = history.countries[country.code] ?? [];
    return {
      ...country,
      cases: sumRange(newCases, start, end),
      deaths: sumRange(newDeaths, start, end),
      newCases: newCases?.[end] ?? 0,
      newDeaths: newDeaths?.[end] ?? 0,
    };
  });
};

/**
 * One country's weekly series as [date, newCases, newDeaths] tuples, the shape
 * the chart already takes for the worldwide series.
 *
 * @param {History} history
 * @param {string} code
 * @returns {Array<[string, number, number]>}
 */
export const countrySeries = (history, code) => {
  const [newCases, newDeaths] = history.countries[code] ?? [];
  return history.weeks.map((date, i) => [date, newCases?.[i] ?? 0, newDeaths?.[i] ?? 0]);
};

/**
 * Trim a weekly series to a range. With no range, the whole series.
 *
 * @param {Array<[string, number, number]>} series
 * @param {Range|null} range
 */
export const seriesForRange = (series, range) =>
  range ? series.filter(([date]) => date >= range.from && date <= range.to) : series;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "6 Sep 2026".
 *
 * Formatted by hand rather than with Intl: the abbreviations come from the
 * runtime's locale data and differ between engines and versions ("Sep" in
 * one, "Sept" in another), so the same page read differently per browser.
 * Working on the ISO string directly also means no Date, so no time zone can
 * move the day.
 *
 * @param {string} isoDate
 */
export const formatWeek = (isoDate) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
};

/** "14 Jun 2026 – 6 Sep 2026", or a single date when the range is one week. */
/** @param {{from: string, to: string}} range */
export const formatRange = ({ from, to }) =>
  from === to ? formatWeek(from) : `${formatWeek(from)} – ${formatWeek(to)}`;
