/**
 * Builds the COVID data snapshot that ships with the app.
 *
 * Why a build step rather than a runtime API call: as of 2026 no public source
 * is simultaneously current, CORS-enabled and small.
 *
 *   - disease.sh is CORS-friendly and small, but its upstreams (JHU CSSE and
 *     Worldometers) stopped publishing, so its figures freeze at 2023-03-09
 *     and its own endpoints disagree by ~28 million cases.
 *   - WHO publishes current figures but serves them from Azure blob storage
 *     with no CORS headers (preflight returns 403), so a browser cannot read it.
 *   - Our World in Data is current and does send CORS, but only as a 17 MB CSV
 *     with no server-side filtering.
 *
 * Running on a build machine removes both constraints: fetch the authoritative
 * WHO file, aggregate it, and emit a small JSON the browser can load instantly.
 *
 * WHO carries no coordinates or flags, so country geometry is taken from
 * disease.sh. That metadata is static — borders do not go stale the way case
 * counts do.
 *
 * Usage: npm run build:data
 */
import { writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const WHO_WEEKLY =
  "https://srhdpeuwpubsa.blob.core.windows.net/whdh/COVID/WHO-COVID-19-global-data.csv";
const GEO = "https://disease.sh/v3/covid-19/countries";
const OUT = new URL("../public/data/covid-snapshot.json", import.meta.url);
const WEEKS = 120;

const get = async (url, as = "text") => {
  const response = await fetch(url, { headers: { "User-Agent": "covid19-tracker-build" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return as === "json" ? response.json() : response.text();
};

/** Minimal CSV row splitter that respects quoted fields (country names contain commas). */
const splitRow = (line) => {
  const cells = [];
  let cell = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }
  cells.push(cell);
  return cells;
};

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const build = async () => {
  console.log("Fetching WHO weekly data…");
  const csv = await get(WHO_WEEKLY);

  console.log("Fetching country geometry…");
  const geo = await get(GEO, "json");

  const geoByIso = new Map(
    geo
      .filter((entry) => entry.countryInfo?.iso2 && entry.countryInfo?.lat != null)
      .map((entry) => [entry.countryInfo.iso2, entry.countryInfo])
  );

  const rows = csv
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map(splitRow)
    .filter((cells) => cells.length >= 8 && cells[1]?.length === 2);

  // Latest row per country, plus a global weekly series.
  const latestByIso = new Map();
  const series = new Map();

  for (const [date, iso, name, region, newCases, cases, newDeaths, deaths] of rows) {
    const previous = latestByIso.get(iso);
    if (!previous || date > previous.date) {
      latestByIso.set(iso, {
        date,
        iso,
        name,
        region,
        newCases: num(newCases),
        cases: num(cases),
        newDeaths: num(newDeaths),
        deaths: num(deaths),
      });
    }

    const week = series.get(date) ?? { newCases: 0, newDeaths: 0 };
    week.newCases += num(newCases);
    week.newDeaths += num(newDeaths);
    series.set(date, week);
  }

  const countries = [...latestByIso.values()]
    .map((entry) => {
      const geometry = geoByIso.get(entry.iso);
      if (!geometry) return null;

      return {
        code: entry.iso,
        name: entry.name,
        lat: geometry.lat,
        long: geometry.long,
        flag: geometry.flag,
        cases: entry.cases,
        deaths: entry.deaths,
        newCases: entry.newCases,
        newDeaths: entry.newDeaths,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.cases - a.cases);

  const weeks = [...series.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-WEEKS)
    .map(([date, week]) => [date, week.newCases, week.newDeaths]);

  const updated = [...latestByIso.values()].reduce(
    (latest, entry) => (entry.date > latest ? entry.date : latest),
    ""
  );

  const snapshot = {
    updated,
    source: "World Health Organization",
    sourceUrl: "https://data.who.int/dashboards/covid19/data",
    generatedAt: new Date().toISOString().slice(0, 10),
    global: {
      cases: countries.reduce((total, c) => total + c.cases, 0),
      deaths: countries.reduce((total, c) => total + c.deaths, 0),
      newCases: countries.reduce((total, c) => total + c.newCases, 0),
      newDeaths: countries.reduce((total, c) => total + c.newDeaths, 0),
    },
    countries,
    weeks,
  };

  await mkdir(new URL(".", OUT), { recursive: true });
  const json = JSON.stringify(snapshot);
  await writeFile(OUT, `${json}\n`);

  console.log(`\nWrote public/data/covid-snapshot.json`);
  console.log(`  data through : ${snapshot.updated}`);
  console.log(`  countries    : ${countries.length}`);
  console.log(`  weeks        : ${weeks.length}`);
  console.log(`  global cases : ${snapshot.global.cases.toLocaleString("en-US")}`);
  console.log(`  global deaths: ${snapshot.global.deaths.toLocaleString("en-US")}`);
  console.log(
    `  size         : ${(json.length / 1024).toFixed(1)}KB raw, ` +
      `${(gzipSync(json).length / 1024).toFixed(1)}KB gzipped`
  );
};

build().catch((error) => {
  console.error(`\nData build failed: ${error.message}`);
  process.exit(1);
});
