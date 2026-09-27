/**
 * Deterministic stand-in for the generated data snapshot.
 *
 * The shipped snapshot is regenerated from WHO data, so its numbers change over
 * time. Serving a fixture keeps assertions stable while still exercising the
 * real fetch path and the real production bundle.
 */
export const SNAPSHOT = {
  updated: "2026-08-02",
  source: "World Health Organization",
  sourceUrl: "https://data.who.int/dashboards/covid19/data",
  generatedAt: "2026-08-24",
  global: { cases: 777627275, deaths: 7106278, newCases: 41000, newDeaths: 300 },
  countries: [
    {
      code: "US",
      name: "United States of America",
      lat: 38,
      long: -97,
      flag: "https://disease.sh/assets/img/flags/us.png",
      cases: 103436829,
      deaths: 1200000,
      newCases: 5000,
      newDeaths: 40,
    },
    {
      code: "IN",
      name: "India",
      lat: 20,
      long: 77,
      flag: "https://disease.sh/assets/img/flags/in.png",
      cases: 45056221,
      deaths: 533570,
      newCases: 90000,
      newDeaths: 2,
    },
    {
      code: "GB",
      name: "United Kingdom of Great Britain and Northern Ireland",
      lat: 54,
      long: -2,
      flag: "https://disease.sh/assets/img/flags/gb.png",
      cases: 25118755,
      deaths: 220000,
      newCases: 300,
      newDeaths: 1,
    },
    {
      // A WHO territory the geometry source does not cover: in the totals and
      // the table, but with nowhere to be drawn.
      code: "PR",
      name: "Puerto Rico",
      lat: null,
      long: null,
      flag: null,
      cases: 1252713,
      deaths: 5938,
      newCases: 0,
      newDeaths: 0,
    },
  ],
  weeks: Array.from({ length: 60 }, (_, i) => {
    const date = new Date(Date.UTC(2025, 5, 1) + i * 7 * 86400000);
    const wave = 1 + Math.sin(i / 7) * 0.6;
    return /** @type {[string, number, number]} */ ([
      date.toISOString().slice(0, 10),
      Math.round(40000 * wave),
      Math.round(300 * wave),
    ]);
  }),
};

/**
 * Each country's weekly figures, split from SNAPSHOT.weeks so that every week
 * sums exactly to the worldwide series, as the real files do. Puerto Rico has
 * nothing to report and is omitted, as the build omits such countries.
 */
export const HISTORY = {
  weeks: SNAPSHOT.weeks.map(([date]) => date),
  countries: (() => {
    const split = (/** @type {number} */ total) => {
      const us = Math.round(total * 0.5);
      const india = Math.round(total * 0.3);
      return [us, india, total - us - india];
    };
    const cases = SNAPSHOT.weeks.map(([, c]) => split(c));
    const deaths = SNAPSHOT.weeks.map(([, , d]) => split(d));
    const series = (/** @type {number} */ i) => [
      cases.map((week) => week[i]),
      deaths.map((week) => week[i]),
    ];
    return { US: series(0), IN: series(1), GB: series(2) };
  })(),
};

/** Serve the fixture data and keep third-party assets off the network. */
export const stubApi = async (page) => {
  await page.route("**/data/covid-snapshot.json", (route) =>
    route.fulfill({ json: SNAPSHOT })
  );
  await page.route("**/data/covid-history.json", (route) =>
    route.fulfill({ json: HISTORY })
  );

  await page.route("**/tile.openstreetmap.org/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.alloc(0) })
  );
  await page.route("**/assets/img/flags/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.alloc(0) })
  );
};
