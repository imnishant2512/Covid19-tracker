/**
 * Builds the COVID data snapshot that ships with the app.
 *
 * Fetches WHO's weekly file, joins it with country geometry, and writes a small
 * JSON the browser can load in one same-origin request.
 *
 * See docs/data-source.md for why this runs at build time rather than the app
 * calling an API directly, and for what the choice of source implies.
 *
 * Usage: npm run build:data
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";

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

/**
 * Do two snapshots carry the same figures?
 *
 * `generatedAt` records when the fetch ran and moves on every run, so comparing
 * whole files reported a change even when WHO had published nothing.
 *
 * @param {object} a
 * @param {object} b
 */
export const sameFigures = (a, b) => {
  const withoutStamp = (value) => {
    const copy = { ...value };
    delete copy.generatedAt;
    return JSON.stringify(copy);
  };

  return withoutStamp(a) === withoutStamp(b);
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

  // `generatedAt` records when the fetch ran, so it differs on every run even
  // when WHO has published nothing new. Writing it unconditionally defeated the
  // "commit only when the figures change" guard downstream: the file always
  // differed, so every scheduled run committed and — once deploys were
  // automated — republished the site for no reason.
  //
  // Compare everything except that field, and leave the file untouched when the
  // figures have not moved.
  const previous = await readFile(OUT, "utf8").catch(() => null);
  if (previous) {
    try {
      if (sameFigures(JSON.parse(previous), snapshot)) {
        console.log(`\nWHO figures are unchanged through ${snapshot.updated}.`);
        console.log("  Left public/data/covid-snapshot.json untouched.");
        return;
      }
    } catch {
      // An unreadable existing file is no reason to skip the write.
    }
  }

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

// Only run when invoked directly, so sameFigures can be imported by tests
// without triggering a network fetch.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((error) => {
    console.error(`\nData build failed: ${error.message}`);
    process.exit(1);
  });
}
