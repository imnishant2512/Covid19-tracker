import numeral from "numeral";

/** "1.2m" for large figures; "0" for null/undefined/0. */
/** @param {number|null|undefined} stat */
export const prettyPrintStat = (stat) => (stat ? numeral(stat).format("0.0a") : "0");

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
