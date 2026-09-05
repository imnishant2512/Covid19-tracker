/**
 * These specs touch no DOM, so they skip the ~5s jsdom construction.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { sameFigures } from "../../scripts/build-data.mjs";

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
