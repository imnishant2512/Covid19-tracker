/**
 * These specs touch no DOM, so they skip the ~5s jsdom construction.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  assemble,
  assertPlausible,
  sameFigures,
} from "../../scripts/build-data.mjs";

const snapshot = (overrides = {}) => ({
  updated: "2026-08-09",
  source: "World Health Organization",
  sourceUrl: "https://data.who.int/dashboards/covid19/data",
  generatedAt: "2026-08-31",
  global: { cases: 777648899, deaths: 7106444, newCases: 0, newDeaths: 0 },
  countries: [{ code: "US", name: "United States", cases: 103436829 }],
  weeks: [["2026-08-09", 100, 5]],
  ...overrides,
});

describe("sameFigures", () => {
  it("ignores generatedAt, which moves on every run", () => {
    // The bug this guards: the snapshot embeds the date the fetch ran, so a
    // whole-file comparison reported a change every week even when WHO had
    // published nothing. That committed and — once deploys were automated —
    // republished the site for no reason.
    expect(
      sameFigures(
        snapshot({ generatedAt: "2026-08-31" }),
        snapshot({ generatedAt: "2026-09-05" })
      )
    ).toBe(true);
  });

  it("still detects a change in the reporting period", () => {
    expect(sameFigures(snapshot(), snapshot({ updated: "2026-08-16" }))).toBe(false);
  });

  it("still detects a change in the global figures", () => {
    expect(
      sameFigures(
        snapshot(),
        snapshot({
          global: { cases: 777648900, deaths: 7106444, newCases: 0, newDeaths: 0 },
        })
      )
    ).toBe(false);
  });

  it("still detects a change in a single country", () => {
    expect(
      sameFigures(
        snapshot(),
        snapshot({
          countries: [{ code: "US", name: "United States", cases: 103436830 }],
        })
      )
    ).toBe(false);
  });

  it("still detects a change in the weekly series", () => {
    expect(
      sameFigures(snapshot(), snapshot({ weeks: [["2026-08-09", 101, 5]] }))
    ).toBe(false);
  });

  it("treats a missing generatedAt as equivalent to any value", () => {
    const withStamp = snapshot();
    const withoutStamp = snapshot();
    delete withoutStamp.generatedAt;

    expect(sameFigures(withStamp, withoutStamp)).toBe(true);
  });
});

// WHO's column order: Date_reported, Country_code, Country, WHO_region,
// New_cases, Cumulative_cases, New_deaths, Cumulative_deaths.
const CSV = [
  "Date_reported,Country_code,Country,WHO_region,New_cases,Cumulative_cases,New_deaths,Cumulative_deaths",
  "2026-08-30,US,United States of America,AMR,10,1000,1,100",
  "2026-09-06,US,United States of America,AMR,20,1020,2,102",
  "2026-08-30,PR,Puerto Rico,AMR,,500,,50",
  "2026-09-06,PR,Puerto Rico,AMR,5,505,,50",
  '2026-09-06,XK,"Kosovo (in accordance with UN Security Council resolution 1244 (1999))",EUR,,300,,30',
].join("\n");

const GEO = [
  { countryInfo: { iso2: "US", lat: 38, long: -97, flag: "us.png" } },
];

describe("assemble", () => {
  it("keeps countries that have no map geometry", () => {
    // The bug this guards: countries without geometry were dropped entirely,
    // taking Puerto Rico, Kosovo and seven others out of the table, the picker
    // and the worldwide totals.
    const { countries } = assemble(CSV, GEO);

    expect(countries.map((c) => c.code)).toEqual(["US", "PR", "XK"]);
    expect(countries[1]).toMatchObject({
      name: "Puerto Rico",
      lat: null,
      long: null,
      flag: null,
      cases: 505,
    });
  });

  it("counts every WHO country in the worldwide totals", () => {
    const { global } = assemble(CSV, GEO);

    expect(global).toEqual({
      cases: 1020 + 505 + 300,
      deaths: 102 + 50 + 30,
      newCases: 20 + 5,
      newDeaths: 2,
    });
  });

  it("agrees with the weekly series for the latest week", () => {
    const { global, weeks, updated } = assemble(CSV, GEO);
    const latest = weeks.find(([date]) => date === updated);

    expect(latest).toEqual(["2026-09-06", global.newCases, global.newDeaths]);
  });

  it("keeps a quoted country name that contains commas intact", () => {
    const kosovo = assemble(CSV, GEO).countries.find((c) => c.code === "XK");
    expect(kosovo.name).toBe(
      "Kosovo (in accordance with UN Security Council resolution 1244 (1999))"
    );
  });

  it("uses the geometry where there is some", () => {
    const us = assemble(CSV, GEO).countries.find((c) => c.code === "US");
    expect(us).toMatchObject({ lat: 38, long: -97, flag: "us.png" });
  });
});

describe("assertPlausible", () => {
  const next = (overrides = {}) => ({
    updated: "2026-09-06",
    countries: Array.from({ length: 234 }, (_, i) => ({ code: String(i) })),
    weeks: [["2026-09-06", 1, 0]],
    ...overrides,
  });

  it("accepts a normal week-on-week update", () => {
    expect(() =>
      assertPlausible(next({ updated: "2026-08-30" }), next())
    ).not.toThrow();
  });

  it("accepts a first snapshot with nothing to compare against", () => {
    expect(() => assertPlausible(null, next())).not.toThrow();
  });

  it("rejects an empty snapshot", () => {
    expect(() => assertPlausible(null, next({ countries: [] }))).toThrow(/empty/);
    expect(() => assertPlausible(null, next({ weeks: [] }))).toThrow(/empty/);
  });

  it("rejects data that goes back in time", () => {
    expect(() =>
      assertPlausible(next(), next({ updated: "2026-08-30" }))
    ).toThrow(/back in time/);
  });

  it("rejects a sudden loss of countries", () => {
    // What an empty or partial upstream response would look like.
    expect(() =>
      assertPlausible(next(), next({ countries: next().countries.slice(0, 200) }))
    ).toThrow(/34 fewer countries/);
  });

  it("tolerates a country or two coming and going", () => {
    expect(() =>
      assertPlausible(next(), next({ countries: next().countries.slice(0, 231) }))
    ).not.toThrow();
  });
});

describe("assemble: weekly history", () => {
  it("aligns each country's weeks with the global series", () => {
    const { history, weeks } = assemble(CSV, GEO);
    expect(history.weeks).toEqual(weeks.map(([date]) => date));
    expect(history.countries.US).toEqual([
      [10, 20],
      [1, 2],
    ]);
  });

  it("sums, week by week, to the global series", () => {
    // The date filter totals countries from the history and the world from the
    // snapshot; this is what keeps the table adding up to the cards.
    const { history, weeks } = assemble(CSV, GEO);
    weeks.forEach(([, cases, deaths], i) => {
      const sum = (k) =>
        Object.values(history.countries).reduce((t, series) => t + series[k][i], 0);
      expect(sum(0)).toBe(cases);
      expect(sum(1)).toBe(deaths);
    });
  });

  it("zero-fills a week a country did not report", () => {
    // Puerto Rico reports blank new cases on 08-30, which WHO means as none.
    expect(assemble(CSV, GEO).history.countries.PR).toEqual([
      [0, 5],
      [0, 0],
    ]);
  });

  it("omits countries with nothing to report in the window", () => {
    // Kosovo has a cumulative total but no new cases or deaths at all.
    expect(assemble(CSV, GEO).history.countries).not.toHaveProperty("XK");
  });
});
