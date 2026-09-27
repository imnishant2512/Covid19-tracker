import numeral from "numeral";

/**
 * "1.2m" for large figures, "830" below a thousand, "0" for null/undefined/0.
 *
 * Only abbreviated figures carry a decimal: "0.0a" alone rendered 830 deaths
 * as "830.0", which suggests a precision a count does not have. Rare with
 * all-time totals, common once the date filter shows a few weeks.
 *
 * @param {number|null|undefined} stat
 */
export const prettyPrintStat = (stat) => {
  if (!stat) return "0";
  return numeral(stat).format(Math.abs(stat) < 1000 ? "0,0" : "0.0a");
};

/** "1,234,567" — no zero padding. */
/** @param {number|null|undefined} value */
export const formatNumber = (value) => numeral(value ?? 0).format("0,0");

/**
 * Axis labels: abbreviate only past a thousand.
 *
 * Formatting every tick as "0a" collapsed small ranges into repeated labels
 * (6.5, 7.0 and 7.4 all rendered as "7") and rendered both 1500 and 2000 as "2k".
 */
/** @param {number} value */
export const formatAxisTick = (value) =>
  Math.abs(value) >= 1000
    ? numeral(value).format("0.[0]a")
    : numeral(value).format("0,0");

/** Tooltip figures carry an explicit sign, since they are per-period deltas. */
/** @param {number} value */
export const formatDelta = (value) => numeral(value).format("+0,0");
