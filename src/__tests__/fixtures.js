/** Mirrors the shape emitted by scripts/build-data.mjs. */
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
      flag: "us.png",
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
      flag: "in.png",
      cases: 45056221,
      deaths: 533570,
      newCases: 90000,
      newDeaths: 2,
    },
  ],
  weeks: [
    ["2026-07-19", 500, 12],
    ["2026-07-26", 700, 9],
    ["2026-08-02", 300, 4],
  ],
};

export const okResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});
