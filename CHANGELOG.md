# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-24

### Changed

- **Replaced disease.sh with World Health Organization figures.** disease.sh
  appeared live — its `updated` timestamp always tracked the current day — but
  its upstreams had stopped publishing: JHU CSSE archived on 10 March 2023 and
  Worldometers went quiet. Its cumulative totals were frozen at 2023-03-09, it
  under-reported the WHO case count by roughly 74 million, and its own `/all`
  and `/historical` endpoints disagreed with each other by about 28 million.

  No public API is currently both accurate and usable from a browser: WHO
  serves current data with no CORS headers (preflight returns 403) and only as
  a 26MB CSV, and Our World in Data is CORS-enabled but ships a 17MB file with
  no server-side filtering, and went read-only in March 2026. The aggregation
  therefore runs at build time, where neither constraint applies, and emits a
  40KB snapshot (8KB gzipped) that the app loads in one same-origin request.

- The app now issues **one request for the whole dataset** instead of one per
  country and another per metric. Selecting a country is a local lookup.
- The trend chart covers 120 weeks of newly reported cases or deaths. WHO
  reports per-week counts directly, so the series no longer has to be
  differenced from cumulative totals.
- The country table and map now sort and scale by whichever metric is selected.

### Added

- `scripts/build-data.mjs` and `npm run build:data`, which fetch WHO's weekly
  file, join it with country geometry, and emit the snapshot.
- A scheduled workflow that regenerates the snapshot weekly and commits it only
  when the figures change, after verifying the app still lints, tests and builds.
- A provenance line in the UI naming the source and the date the data covers.

### Removed

- **The Recovered metric.** WHO publishes no recovery figures, so it had no
  source. It is replaced by newly reported cases — the only genuinely current
  signal in the data. The previous source reported `recovered: 0` for most
  countries anyway.

### Known limitations

- WHO reports weekly, and only around 80 countries still report new cases.
  Cumulative totals cover 225 countries; recent activity is far sparser. This
  reflects the state of global COVID reporting rather than a defect.

## [1.0.0] - 2026-08-22

Full modernisation of the original Create React App build, plus fixes for every
defect found in the audit of the initial commit.

### Fixed

- **Map circles rendered in the default Leaflet blue.** `Circle` was given
  react-leaflet v3+'s `pathOptions` while the project ran react-leaflet v2, so
  Leaflet ignored the styling and the cases/recovered/deaths colour coding never
  appeared.
- **No error handling on any request.** A failing or malformed response was
  treated as data; `setLoading(false)` ran only on the success path, so a failure
  left the stat cards spinning forever. Requests now throw on non-2xx and every
  call site handles rejection.
- **Errors from concurrent requests overwrote each other.** The country list and
  the stats request shared one error slot, so whichever settled last cleared the
  other's message. Errors are now scoped per request.
- Missing `key` props on the country dropdown, table rows and map circles.
- `className` templates emitted the literal string `false` when a flag was falsy.
- `InfoBox` ignored the `className` it was passed, and received `isloading`
  where it read `isLoading`.
- A `console.log` after `await` logged the previous country because of a stale
  closure.
- Map zoom never returned to the world view once a country had been selected,
  and "Worldwide" recentred on Delhi rather than the world.
- Table rows were `<tr>`/`<td>` inside a `<div>` with no `<table>` ancestor.
- Rapid country or tab switching could apply responses out of order; all
  requests are now cancelled via `AbortController`.
- Country counts were zero-padded (`000,412` instead of `412`).
- `buildChartData` iterated `data.cases` while reading the selected series, and
  circle radii could evaluate to `NaN` for missing counts.
- **The chart's y-axis repeated the same label.** Formatting every tick as `0a`
  collapsed fractional ticks (6.5, 6.8, 7.0) into an axis reading "7 7 7 7 7",
  and rendered both 1500 and 2000 as "2k". Ticks are now integers, and only
  values past a thousand are abbreviated.
- **The chart's x-axis had no labels at all.** The time scale hardcoded
  `unit: "month"`; Chart.js now selects the unit to suit the range.
- **The chart stayed red for every metric** while the map circles changed
  colour. Both now derive from the same palette entry.
- A country entry returned without a `countryInfo` object threw while the
  dropdown was being built, taking the country list, table and map down with
  it. The adjacent map filter already guarded this; the list did not.
- The stat figure was marked up as an `<h2>`, so screen-reader heading
  navigation announced a bare number ("+1.2k") with no context, from inside a
  button. It is no longer a heading; the card's label is on the button.
- Errors from concurrent requests overwrote one another (see above).

### Changed

- Build tooling: Create React App (`react-scripts` 4) → **Vite 7**.
- React 17 → **19**, using `createRoot`.
- `@material-ui/core` 4 → **`@mui/material` 7**.
- `react-leaflet` 2 → **5**; map recentring now uses `useMap().flyTo`.
- `chart.js` 2 → **4** with `chartjs-adapter-date-fns`; dates are parsed
  explicitly as `M/d/yy` rather than relying on `Date` coercion.
- The 120-day history is fetched once instead of on every tab change.
- Leaflet and Chart.js are lazy-loaded, cutting first-paint JavaScript from
  ~237 KB to ~126 KB gzipped.
- The Font Awesome CDN stylesheet was replaced by a CSS-only spinner that
  respects `prefers-reduced-motion`.
- Data access moved into `src/api.js`; components moved to `src/components/`.
- `eslint-plugin-react-refresh` was registered but enabled no rules; its
  `only-export-components` rule is now on.
- Unit suite runtime cut from ~55s to ~20s by prebundling MUI and Leaflet for
  the test runner, skipping stylesheet processing, and running DOM-free specs in
  the `node` environment instead of paying jsdom's ~5s startup per file. Test
  isolation is retained.

### Added

- Vitest + Testing Library suite (55 specs) with 85% coverage thresholds,
  including regression tests for each bug above. Statement coverage is 99.6%.
- Playwright end-to-end suite (11 specs) driving the real production build in
  Chromium against fixture-stubbed APIs — covering the map's circle colours,
  lazy-chunk loading, keyboard operation, the error banner, a mobile viewport,
  and a check that the console stays free of errors.
- GitHub Actions CI: lint, test with coverage and build on Node 20 and 22, an
  end-to-end job, plus a production dependency audit.
- `ErrorBoundary` around the map and chart panels.
- Accessibility: the stat cards are real buttons with `aria-pressed`, the country
  select has a label, and the table has a screen-reader caption.

### Security

- `npm audit --omit=dev` reports **0 vulnerabilities**, down from the many
  advisories carried by the `react-scripts` 4 dependency tree.

[1.1.0]: https://github.com/imnishant2512/Covid19-tracker/releases/tag/v1.1.0
[1.0.0]: https://github.com/imnishant2512/Covid19-tracker/releases/tag/v1.0.0
