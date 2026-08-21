/**
 * Deterministic stand-ins for the disease.sh API.
 *
 * The E2E suite must not depend on a third-party service that can be slow,
 * rate-limited or simply return different numbers tomorrow, so every run is
 * served these fixtures. The shapes mirror real responses captured from
 * disease.sh v3.
 */

export const WORLDWIDE = {
  updated: 1787338875078,
  cases: 704753890,
  todayCases: 1200,
  deaths: 7010681,
  todayDeaths: 40,
  recovered: 675619811,
  todayRecovered: 790,
};

export const COUNTRIES = [
  {
    country: "India",
    countryInfo: {
      _id: 356,
      iso2: "IN",
      lat: 20,
      long: 77,
      flag: "https://disease.sh/assets/img/flags/in.png",
    },
    cases: 45035393,
    todayCases: 12,
    deaths: 533570,
    todayDeaths: 1,
    recovered: 0,
    todayRecovered: 0,
  },
  {
    country: "Brazil",
    countryInfo: {
      _id: 76,
      iso2: "BR",
      lat: -14,
      long: -51,
      flag: "https://disease.sh/assets/img/flags/br.png",
    },
    cases: 99999999,
    todayCases: 5,
    deaths: 700000,
    todayDeaths: 2,
    recovered: 10,
    todayRecovered: 0,
  },
];

export const INDIA = COUNTRIES[0];

/** 120 days across a real month boundary, with a wave so the chart is representative. */
const series = (start, step) => {
  const entries = [];
  let total = start;
  const from = new Date(2023, 10, 1);

  for (let i = 0; i < 120; i += 1) {
    const date = new Date(from.getTime() + i * 86400000);
    const wave = 1 + Math.sin(i / 9) * 0.6;
    total += Math.round(step * wave);
    entries.push([
      `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(2)}`,
      total,
    ]);
  }

  return Object.fromEntries(entries);
};

export const HISTORICAL = {
  cases: series(1000, 500),
  deaths: series(100, 7),
  recovered: series(50, 3),
};

/** Route every disease.sh call to the fixtures above. */
export const stubApi = async (page) => {
  await page.route("**/disease.sh/**", async (route) => {
    const url = route.request().url();

    const body = url.includes("/historical/")
      ? HISTORICAL
      : url.includes("/countries/IN")
        ? INDIA
        : url.endsWith("/countries")
          ? COUNTRIES
          : WORLDWIDE;

    await route.fulfill({ json: body });
  });

  // Map tiles and flag images are third-party too; keep them off the network.
  await page.route("**/tile.openstreetmap.org/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.alloc(0) })
  );
  await page.route("**/assets/img/flags/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.alloc(0) })
  );
};
