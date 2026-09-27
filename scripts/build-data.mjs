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
const HISTORY_OUT = new URL("../public/data/covid-history.json", import.meta.url);
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

/**
 * Turn WHO's weekly CSV and the country geometry into the snapshot's figures.
 *
 * Every WHO country is kept, whether or not it has geometry. Keeping only the
 * mapped ones silently dropped nine territories — Puerto Rico and Kosovo among
 * them — from the table, the picker and, worst, the worldwide totals, which
 * then understated WHO's own figures by 1.66 million cases. A country without
 * geometry gets null coordinates and is simply left off the map.
 *
 * @param {string} csv
 * @param {Array<{countryInfo?: {iso2?: string, lat?: number, long?: number, flag?: string}}>} geo
 */
export const assemble = (csv, geo) => {
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

  // Latest row per country, a global weekly series, and each country's own
  // weekly figures for the date filter.
  const latestByIso = new Map();
  const series = new Map();
  const weeklyByIso = new Map();

  for (const [date, iso, name, region, newCases, cases, newDeaths, deaths] of rows) {
    const own = weeklyByIso.get(iso) ?? new Map();
    own.set(date, [num(newCases), num(newDeaths)]);
    weeklyByIso.set(iso, own);

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

      return {
        code: entry.iso,
        name: entry.name,
        lat: geometry?.lat ?? null,
        long: geometry?.long ?? null,
        flag: geometry?.flag ?? null,
        cases: entry.cases,
        deaths: entry.deaths,
        newCases: entry.newCases,
        newDeaths: entry.newDeaths,
      };
    })
    .sort((a, b) => b.cases - a.cases);

  const weeks = [...series.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-WEEKS)
    .map(
      ([date, week]) =>
        /** @type {[string, number, number]} */ ([date, week.newCases, week.newDeaths])
    );

  const updated = [...latestByIso.values()].reduce(
    (latest, entry) => (entry.date > latest ? entry.date : latest),
    ""
  );

  return {
    updated,
    global: {
      cases: countries.reduce((total, c) => total + c.cases, 0),
      deaths: countries.reduce((total, c) => total + c.deaths, 0),
      newCases: countries.reduce((total, c) => total + c.newCases, 0),
      newDeaths: countries.reduce((total, c) => total + c.newDeaths, 0),
    },
    countries,
    weeks,
    history: buildHistory(weeks, countries, weeklyByIso),
  };
};

/**
 * Each country's weekly new cases and deaths, aligned to the global series.
 *
 * Shipped as a separate file so the first paint does not wait for it: it is
 * three times the size of the snapshot and only the date filter and the
 * per-country chart need it. Countries with nothing to report across the whole
 * window are omitted, and read back as zeros.
 *
 * @param {Array<[string, number, number]>} weeks
 * @param {Array<{code: string}>} countries
 * @param {Map<string, Map<string, [number, number]>>} weeklyByIso
 * @returns {{weeks: string[], countries: Record<string, [number[], number[]]>}}
 */
const buildHistory = (weeks, countries, weeklyByIso) => {
  const dates = weeks.map(([date]) => date);
  /** @type {Record<string, [number[], number[]]>} */
  const byCountry = {};

  for (const { code } of countries) {
    const own = weeklyByIso.get(code);
    const newCases = dates.map((date) => own?.get(date)?.[0] ?? 0);
    const newDeaths = dates.map((date) => own?.get(date)?.[1] ?? 0);

    if (newCases.some(Boolean) || newDeaths.some(Boolean)) {
      byCountry[code] = [newCases, newDeaths];
    }
  }

  return { weeks: dates, countries: byCountry };
};

/**
 * Refuse a snapshot that looks like a broken upstream rather than real news.
 *
 * The refresh commits and deploys unattended, and its tests run against
 * fixtures, so nothing else would stop an empty geometry response or a
 * truncated CSV from being published as the week's figures.
 *
 * @param {{updated: string, countries: unknown[]}|null} previous
 * @param {{updated: string, countries: unknown[], weeks: unknown[]}} next
 */
export const assertPlausible = (previous, next) => {
  if (!next.updated || next.countries.length === 0 || next.weeks.length === 0) {
    throw new Error("The new snapshot is empty; refusing to write it.");
  }
  if (!previous) return;

  if (next.updated < previous.updated) {
    throw new Error(
      `The new snapshot goes back in time (${previous.updated} → ${next.updated}).`
    );
  }

  // WHO's country list is stable; losing more than a handful means a fetch or
  // parse went wrong, not that countries stopped existing.
  const lost = previous.countries.length - next.countries.length;
  if (lost > 5) {
    throw new Error(
      `The new snapshot has ${lost} fewer countries than the last one ` +
        `(${previous.countries.length} → ${next.countries.length}).`
    );
  }
};

const build = async () => {
  console.log("Fetching WHO weekly data…");
  const csv = await get(WHO_WEEKLY);

  console.log("Fetching country geometry…");
  const geo = await get(GEO, "json");

  const { updated, global, countries, weeks, history } = assemble(csv, geo);
  const snapshot = {
    updated,
    source: "World Health Organization",
    sourceUrl: "https://data.who.int/dashboards/covid19/data",
    generatedAt: new Date().toISOString().slice(0, 10),
    global,
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
  let previous = null;
  try {
    previous = JSON.parse(await readFile(OUT, "utf8"));
  } catch {
    // A missing or unreadable existing file is no reason to skip the write.
  }

  const snapshotChanged = !(previous && sameFigures(previous, snapshot));
  if (snapshotChanged) assertPlausible(previous, snapshot);

  // The history carries no timestamp, so a plain comparison is enough. It is
  // checked on its own so a missing file is written even when the snapshot is
  // unchanged.
  const historyJson = `${JSON.stringify(history)}\n`;
  const previousHistory = await readFile(HISTORY_OUT, "utf8").catch(() => null);
  if (previousHistory !== historyJson) {
    await writeFile(HISTORY_OUT, historyJson);
    console.log(
      `\nWrote public/data/covid-history.json: ` +
        `${Object.keys(history.countries).length} countries × ${history.weeks.length} weeks, ` +
        `${(historyJson.length / 1024).toFixed(1)}KB raw, ` +
        `${(gzipSync(historyJson).length / 1024).toFixed(1)}KB gzipped`
    );
  }

  if (!snapshotChanged) {
    console.log(`\nWHO figures are unchanged through ${snapshot.updated}.`);
    console.log("  Left public/data/covid-snapshot.json untouched.");
    return;
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
