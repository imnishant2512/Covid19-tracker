/**
 * These specs touch no DOM, so they skip the ~5s jsdom construction.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  buildChartData,
  circleRadius,
  formatNumber,
  prettyPrintStat,
  sortData,
  withAlpha,
} from "../util";

describe("sortData", () => {
  it("orders by cases descending", () => {
    const sorted = sortData([
      { country: "A", cases: 5 },
      { country: "B", cases: 50 },
      { country: "C", cases: 15 },
    ]);

    expect(sorted.map((entry) => entry.country)).toEqual(["B", "C", "A"]);
  });

  it("does not mutate its input", () => {
    const input = [{ cases: 1 }, { cases: 9 }];
    sortData(input);
    expect(input[0].cases).toBe(1);
  });
});

describe("prettyPrintStat", () => {
  it("abbreviates and signs real values", () => {
    expect(prettyPrintStat(1200000)).toBe("+1.2m");
  });

  it("renders +0 for missing values", () => {
    expect(prettyPrintStat(0)).toBe("+0");
    expect(prettyPrintStat(null)).toBe("+0");
    expect(prettyPrintStat(undefined)).toBe("+0");
  });
});

describe("formatNumber", () => {
  it("groups thousands without zero padding", () => {
    expect(formatNumber(412)).toBe("412");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("treats missing values as zero", () => {
    expect(formatNumber(null)).toBe("0");
  });
});

describe("buildChartData", () => {
  const history = {
    cases: { "1/1/24": 10, "1/2/24": 15, "1/3/24": 40 },
    deaths: { "1/1/24": 1, "1/2/24": 3, "1/3/24": 4 },
  };

  it("converts a cumulative series into day-over-day deltas", () => {
    expect(buildChartData(history, "cases")).toEqual([
      { x: "1/2/24", y: 5 },
      { x: "1/3/24", y: 25 },
    ]);
  });

  it("reads the selected series, not just cases", () => {
    expect(buildChartData(history, "deaths")).toEqual([
      { x: "1/2/24", y: 2 },
      { x: "1/3/24", y: 1 },
    ]);
  });

  it("returns an empty series when the type is absent", () => {
    expect(buildChartData(history, "recovered")).toEqual([]);
    expect(buildChartData(undefined, "cases")).toEqual([]);
  });
});

describe("circleRadius", () => {
  it("scales with the selected cases type", () => {
    const country = { cases: 1000, deaths: 10 };
    expect(circleRadius(country, "cases")).toBeGreaterThan(
      circleRadius(country, "deaths")
    );
  });

  it("never returns NaN for missing or negative counts", () => {
    expect(circleRadius({}, "cases")).toBe(0);
    expect(circleRadius({ cases: -5 }, "cases")).toBe(0);
  });
});

describe("withAlpha", () => {
  it("converts a palette hex into a translucent rgba string", () => {
    expect(withAlpha("#cc1034", 0.5)).toBe("rgba(204, 16, 52, 0.5)");
    expect(withAlpha("#7dd71d", 0.4)).toBe("rgba(125, 215, 29, 0.4)");
  });

  it("handles greyscale values without producing NaN channels", () => {
    expect(withAlpha("#c0c0c0", 0.5)).toBe("rgba(192, 192, 192, 0.5)");
  });
});
