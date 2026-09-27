/**
 * These specs touch no DOM, so they skip the ~5s jsdom construction.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  countriesForRange,
  countrySeries,
  formatRange,
  formatWeek,
  globalForRange,
  resolveRange,
  seriesForRange,
  toQuery,
} from "../lib/range";

// Sundays, as WHO reports them.
const WEEKS = ["2026-08-09", "2026-08-16", "2026-08-23", "2026-08-30", "2026-09-06"];

describe("resolveRange", () => {
  it("is all time when nothing is asked for", () => {
    expect(resolveRange({}, WEEKS)).toBeNull();
    expect(resolveRange({ period: null, from: null, to: null }, WEEKS)).toBeNull();
  });

  it("is all time when there is no data yet", () => {
    expect(resolveRange({ period: "4w" }, [])).toBeNull();
  });

  it("counts a preset back from the latest week", () => {
    expect(resolveRange({ period: "4w" }, WEEKS)).toEqual({
      from: "2026-08-16",
      to: "2026-09-06",
      startIndex: 1,
      endIndex: 4,
      preset: "4w",
    });
  });

  it("stays relative, so a bookmarked preset follows new data", () => {
    const later = [...WEEKS, "2026-09-13"];
    expect(resolveRange({ period: "4w" }, later)).toMatchObject({
      from: "2026-08-23",
      to: "2026-09-13",
    });
  });

  it("uses every week there is when a preset is longer than the data", () => {
    expect(resolveRange({ period: "1y" }, WEEKS)).toMatchObject({
      from: WEEKS[0],
      startIndex: 0,
    });
  });

  it("ignores an unknown preset", () => {
    expect(resolveRange({ period: "forever" }, WEEKS)).toBeNull();
  });

  it("takes explicit reporting weeks as given", () => {
    expect(resolveRange({ from: "2026-08-16", to: "2026-08-30" }, WEEKS)).toEqual({
      from: "2026-08-16",
      to: "2026-08-30",
      startIndex: 1,
      endIndex: 3,
      preset: null,
    });
  });

  it("snaps dates between reporting weeks inward", () => {
    // A hand-edited or shared URL need not land on a Sunday.
    expect(resolveRange({ from: "2026-08-12", to: "2026-09-01" }, WEEKS)).toMatchObject({
      from: "2026-08-16",
      to: "2026-08-30",
    });
  });

  it("swaps dates given backwards", () => {
    expect(resolveRange({ from: "2026-08-30", to: "2026-08-16" }, WEEKS)).toMatchObject({
      from: "2026-08-16",
      to: "2026-08-30",
    });
  });

  it("runs to the latest week when only a start is given, and from the first when only an end is", () => {
    expect(resolveRange({ from: "2026-08-30" }, WEEKS)).toMatchObject({
      from: "2026-08-30",
      to: "2026-09-06",
    });
    expect(resolveRange({ to: "2026-08-16" }, WEEKS)).toMatchObject({
      from: "2026-08-09",
      to: "2026-08-16",
    });
  });

  it("clamps a range outside the data to its nearest end", () => {
    expect(resolveRange({ from: "2030-01-01", to: "2030-02-01" }, WEEKS)).toMatchObject({
      from: "2026-09-06",
      to: "2026-09-06",
    });
    expect(resolveRange({ from: "2020-01-01", to: "2020-02-01" }, WEEKS)).toMatchObject({
      from: "2026-08-09",
      to: "2026-08-09",
    });
  });

  it("treats anything that is not a date as absent", () => {
    expect(resolveRange({ from: "yesterday", to: "<script>" }, WEEKS)).toBeNull();
  });
});

describe("toQuery", () => {
  it("round-trips through resolveRange", () => {
    for (const query of [{ period: "3m" }, { from: "2026-08-16", to: "2026-08-30" }]) {
      expect(toQuery(resolveRange(query, WEEKS))).toEqual(query);
    }
    expect(toQuery(null)).toEqual({});
  });
});

const SERIES = /** @type {Array<[string, number, number]>} */ ([
  ["2026-08-09", 10, 1],
  ["2026-08-16", 20, 2],
  ["2026-08-23", 30, 3],
  ["2026-08-30", 40, 4],
  ["2026-09-06", 50, 5],
]);

describe("globalForRange", () => {
  it("totals cases and deaths over the range, and takes new ones from its last week", () => {
    const range = resolveRange({ from: "2026-08-16", to: "2026-08-30" }, WEEKS);
    expect(globalForRange(SERIES, range)).toEqual({
      cases: 20 + 30 + 40,
      deaths: 2 + 3 + 4,
      newCases: 40,
      newDeaths: 4,
    });
  });
});

/** @type {import("../lib/range").History} */
const HISTORY = {
  weeks: WEEKS,
  countries: {
    AA: [
      [1, 2, 3, 4, 5],
      [0, 0, 1, 0, 1],
    ],
    BB: [
      [9, 18, 27, 36, 45],
      [1, 2, 2, 4, 4],
    ],
  },
};
const COUNTRIES = [
  { code: "AA", name: "A", cases: 1000, deaths: 10, newCases: 5, newDeaths: 1 },
  { code: "BB", name: "B", cases: 9000, deaths: 90, newCases: 45, newDeaths: 4 },
  { code: "CC", name: "C (nothing reported in the window)", cases: 7, deaths: 0, newCases: 0, newDeaths: 0 },
];

describe("countriesForRange", () => {
  const range = resolveRange({ from: "2026-08-16", to: "2026-08-30" }, WEEKS);

  it("totals each country over the range", () => {
    const [a, b] = countriesForRange(COUNTRIES, HISTORY, range);
    expect(a).toMatchObject({ code: "AA", name: "A", cases: 9, deaths: 1, newCases: 4, newDeaths: 0 });
    expect(b).toMatchObject({ code: "BB", cases: 81, deaths: 8, newCases: 36, newDeaths: 4 });
  });

  it("reads a country missing from the history as zeros, not as its all-time figures", () => {
    const c = countriesForRange(COUNTRIES, HISTORY, range)[2];
    expect(c).toMatchObject({ cases: 0, deaths: 0, newCases: 0, newDeaths: 0 });
  });

  it("agrees with the worldwide figures when the files agree", () => {
    const series = /** @type {Array<[string, number, number]>} */ (
      WEEKS.map((date, i) => [
        date,
        HISTORY.countries.AA[0][i] + HISTORY.countries.BB[0][i],
        HISTORY.countries.AA[1][i] + HISTORY.countries.BB[1][i],
      ])
    );
    const rows = countriesForRange(COUNTRIES, HISTORY, range);
    const global = globalForRange(series, range);

    expect(rows.reduce((t, r) => t + r.cases, 0)).toBe(global.cases);
    expect(rows.reduce((t, r) => t + r.deaths, 0)).toBe(global.deaths);
  });

  it("looks weeks up by date, so a history from another build cannot shift them", () => {
    // Shifted by one week relative to the snapshot the range was resolved on.
    const shifted = { ...HISTORY, weeks: [...WEEKS.slice(1), "2026-09-13"] };
    const [a] = countriesForRange(COUNTRIES, shifted, range);
    expect(a.cases).toBe(1 + 2 + 3);
  });

  it("returns nothing rather than wrong figures when the range is not in the history", () => {
    const other = { weeks: ["2020-01-05"], countries: {} };
    expect(countriesForRange(COUNTRIES, other, range)).toEqual([]);
  });
});

describe("countrySeries and seriesForRange", () => {
  it("builds a country's weekly tuples, zero-filled if it reported nothing", () => {
    expect(countrySeries(HISTORY, "AA")[2]).toEqual(["2026-08-23", 3, 1]);
    expect(countrySeries(HISTORY, "CC")).toHaveLength(WEEKS.length);
    expect(countrySeries(HISTORY, "CC").every(([, c, d]) => c === 0 && d === 0)).toBe(true);
  });

  it("trims a series to the range, or leaves it whole for all time", () => {
    const range = resolveRange({ from: "2026-08-23", to: "2026-08-30" }, WEEKS);
    expect(seriesForRange(SERIES, range).map(([date]) => date)).toEqual([
      "2026-08-23",
      "2026-08-30",
    ]);
    expect(seriesForRange(SERIES, null)).toBe(SERIES);
  });
});

describe("formatting", () => {
  it("formats a week the same way on every engine and in every time zone", () => {
    // Intl gave "Sept" on this Node and "Sep" elsewhere; a Date parse would
    // also have shown the previous day west of Greenwich.
    expect(formatWeek("2026-09-06")).toBe("6 Sep 2026");
    expect(formatWeek("2026-01-01")).toBe("1 Jan 2026");
    expect(formatWeek("2026-12-31")).toBe("31 Dec 2026");
  });

  it("formats a range, collapsing a single week", () => {
    expect(formatRange({ from: "2026-06-14", to: "2026-09-06" })).toBe(
      "14 Jun 2026 – 6 Sep 2026"
    );
    expect(formatRange({ from: "2026-09-06", to: "2026-09-06" })).toBe("6 Sep 2026");
  });
});
