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
  ],
  weeks: Array.from({ length: 60 }, (_, i) => {
    const date = new Date(Date.UTC(2025, 5, 1) + i * 7 * 86400000);
    const wave = 1 + Math.sin(i / 7) * 0.6;
    return [
      date.toISOString().slice(0, 10),
      Math.round(40000 * wave),
      Math.round(300 * wave),
    ];
  }),
};

/** Serve the fixture snapshot and keep third-party assets off the network. */
export const stubApi = async (page) => {
  await page.route("**/data/covid-snapshot.json", (route) =>
    route.fulfill({ json: SNAPSHOT })
  );

  await page.route("**/tile.openstreetmap.org/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.alloc(0) })
  );
  await page.route("**/assets/img/flags/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.alloc(0) })
  );
};
