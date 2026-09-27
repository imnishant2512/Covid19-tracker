/**
 * These specs touch no DOM, so they skip the ~5s jsdom construction.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { MAX_RADIUS, METRICS, circleRadius, sortByMetric } from "../lib/metrics";
import { formatNumber, prettyPrintStat } from "../lib/format";
import { buildChartData } from "../lib/chart";
import { withAlpha } from "../theme";

const COUNTRIES = [
  { code: "AA", cases: 5, newCases: 90, deaths: 3 },
  { code: "BB", cases: 50, newCases: 1, deaths: 30 },
  { code: "CC", cases: 15, newCases: 40, deaths: 1 },
];

describe("sortByMetric", () => {
  it("orders by the selected metric, not always by cases", () => {
    expect(sortByMetric(COUNTRIES, "cases").map((c) => c.code)).toEqual([
      "BB",
      "CC",
      "AA",
    ]);
    expect(sortByMetric(COUNTRIES, "newCases").map((c) => c.code)).toEqual([
      "AA",
      "CC",
      "BB",
    ]);
  });

  it("does not mutate its input", () => {
    const input = [{ cases: 1 }, { cases: 9 }];
    sortByMetric(input, "cases");
    expect(input[0].cases).toBe(1);
  });

  it("treats a missing figure as zero rather than sorting it randomly", () => {
    const sorted = sortByMetric([{ code: "X" }, { code: "Y", cases: 5 }], "cases");
    expect(sorted[0].code).toBe("Y");
  });
});

describe("prettyPrintStat", () => {
  it("abbreviates large values", () => {
    expect(prettyPrintStat(1200000)).toBe("1.2m");
    expect(prettyPrintStat(45056221)).toBe("45.1m");
  });

  it("shows counts below a thousand as whole numbers", () => {
    expect(prettyPrintStat(830)).toBe("830");
    expect(prettyPrintStat(13)).toBe("13");
    expect(prettyPrintStat(999)).toBe("999");
    expect(prettyPrintStat(1000)).toBe("1.0k");
  });

  it("renders 0 for missing values", () => {
    expect(prettyPrintStat(0)).toBe("0");
    expect(prettyPrintStat(null)).toBe("0");
    expect(prettyPrintStat(undefined)).toBe("0");
  });
});

describe("formatNumber", () => {
  it("groups thousands without zero padding", () => {
    expect(formatNumber(412)).toBe("412");
    expect(formatNumber(777627275)).toBe("777,627,275");
  });

  it("treats missing values as zero", () => {
    expect(formatNumber(null)).toBe("0");
  });
});

describe("buildChartData", () => {
  /** @type {Array<[string, number, number]>} */
  const weeks = [
    ["2026-07-19", 500, 12],
    ["2026-07-26", 700, 9],
    ["2026-08-02", 300, 4],
  ];

  it("reads the case column for case metrics", () => {
    expect(buildChartData(weeks, "cases")).toEqual([
      { x: "2026-07-19", y: 500 },
      { x: "2026-07-26", y: 700 },
      { x: "2026-08-02", y: 300 },
    ]);
    expect(buildChartData(weeks, "newCases")).toEqual(
      buildChartData(weeks, "cases")
    );
  });

  it("reads the death column for the deaths metric", () => {
    expect(buildChartData(weeks, "deaths").map((p) => p.y)).toEqual([12, 9, 4]);
  });

  it("returns an empty series when there is no data yet", () => {
    expect(buildChartData(undefined, "cases")).toEqual([]);
    expect(buildChartData(null, "cases")).toEqual([]);
  });

  it("does not difference the series: WHO already reports per-week counts", () => {
    // The previous source gave cumulative totals that had to be differenced,
    // which is where the NaN points came from. These values pass through.
    expect(buildChartData(weeks, "cases").map((p) => p.y)).toEqual([500, 700, 300]);
  });
});

describe("circleRadius", () => {
  it("draws the largest value in view at the maximum radius", () => {
    expect(circleRadius(103_436_829, 103_436_829)).toBe(MAX_RADIUS);
  });

  it("makes area, not radius, proportional to the value", () => {
    // A quarter of the value is half the radius, so a quarter of the area.
    expect(circleRadius(25, 100)).toBeCloseTo(MAX_RADIUS / 2);
  });

  it("scales to the values in view, not to a fixed multiplier", () => {
    // The regression this guards: fixed multipliers tuned for all-time totals
    // drew a three-month period as dots too small to see. The largest circle
    // is now the same size whatever the period.
    expect(circleRadius(50_000, 50_000)).toBe(circleRadius(103_436_829, 103_436_829));
  });

  it("never returns NaN for missing, negative or empty values", () => {
    expect(circleRadius(undefined, 100)).toBe(0);
    expect(circleRadius(-5, 100)).toBe(0);
    expect(circleRadius(0, 0)).toBe(0);
  });
});

describe("withAlpha", () => {
  it("converts a palette hex into a translucent rgba string", () => {
    expect(withAlpha("#cc1034", 0.5)).toBe("rgba(204, 16, 52, 0.5)");
  });
});

describe("METRICS", () => {
  it("gives every metric a distinct colour", () => {
    const hexes = Object.values(METRICS).map((m) => m.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it("has no recovered metric, because WHO publishes no recovery figures", () => {
    expect(METRICS.recovered).toBeUndefined();
  });
});
