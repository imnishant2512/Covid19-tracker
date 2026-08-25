# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-08-25

Every dependency brought current: seven majors, taken one at a time with the
suite green between each. `npm outdated` is now empty and the audit reports no
vulnerabilities.

### Changed

- **ESLint 9 → 10**, with `eslint-plugin-react-hooks` 5 → 7. The new plugin
  applies sixteen rules where the old one applied a handful; the code passes
  unchanged.
- **Vitest 3 → 4** and `@vitest/coverage-v8` 3 → 4.
- **Vite 7 → 8**, which bundles with Rolldown. Build time fell from about
  fifteen seconds to three.
- **TypeScript 5 → 7**, **MUI 7 → 9**, jsdom 26 → 29, and the remaining minor
  and type packages.

### Fixed

Three of the upgrades broke something quietly rather than loudly, which is the
part worth recording:

- **Vitest 4 renamed `deps.optimizer.web` to `deps.optimizer.client`.** The old
  key is ignored without warning, so the prebundling this project relies on
  silently stopped: test import time went from ~26s to ~80s and the heaviest DOM
  spec began timing out.
- Repairing that exposed a second problem. With prebundling working again, the
  Map spec failed, because Leaflet gets a **distinct module instance** when
  prebundled and spying on `L.Map.prototype` no longer intercepts the call
  react-leaflet makes. That test had only ever passed because the optimizer
  config was broken. Leaflet is now excluded from the prebundle list.
- **Vite 8's Rolldown rejects the object form of `manualChunks`**, and Vite 8's
  own `defineConfig` type no longer accepts Vitest's `test` key.

### Added

- **Six specs for `useColorScheme`**, which had none. `@vitest/coverage-v8` 4
  counts statements more precisely, and the apparent drop from 99.4% to 94.0%
  turned out to be a real gap rather than a regression: the media-query
  listener, the scheme changing while the page is open, listener cleanup and the
  missing-`matchMedia` fallback were all untested. Coverage is back to 97.8%.
- **A `Snapshot` typedef**, plus `Country` and `MetricKey`. TypeScript 7 defaults
  `strict` on, and while `strict` itself is pinned false for now, the useful
  findings are fixed: the data snapshot was being passed around as `object`, so
  none of App's property access was checked.

### Known limitations

- Suite runtime roughly doubled. Vitest 4 costs materially more per file to
  construct a test environment on this hardware; capping workers made contention
  worse and reverting jsdom changed nothing. `testTimeout` is raised to 15s after
  that diagnosis rather than instead of it — the heaviest spec measures ~850ms in
  isolation, so the headroom is for contention, not a slow test.
- Enabling `strict` surfaces 51 further findings, mostly implicit-any parameters
  in the specs. Worth doing as its own piece of work.

## [1.2.0] - 2026-08-25

A quality pass over structure, styling, types and documentation, plus the
release and branch tidying that followed.

### Fixed

- **The "New Cases" figure failed WCAG AA.** The amber used for it sat at
  2.01:1 against the card, below even the 3.0 threshold that large text is
  allowed. It is now `#a16207` at 4.92:1, chosen to stay distinguishable from
  the other two metrics on the map. A test now computes the contrast of every
  metric colour and fails below 4.5:1.
- **A country returned without a `countryInfo` object threw** while the dropdown
  was built, taking the list, table and map down with it. The map filter beside
  it already guarded this case.
- **The stat figure was marked up as an `<h2>`**, so screen-reader heading
  navigation announced a bare number with no context, from inside a button.
- **Long country names were clipped.** "United Kingdom of Great Britain and
  Northern Ireland" pushed the figure out of its row.
- Three defects found by turning on type checking: the changelog script still
  carried a fragile entry-point guard because an earlier edit had silently
  failed; an `exact: true` option was passed to Testing Library's `findByRole`,
  which is not part of its API and was being ignored; and `@types/leaflet` was
  missing, so react-leaflet prop types were degrading to empty and validating
  nothing.

### Changed

- **Design tokens.** Colours, spacing and radii moved into
  `src/styles/tokens.css`; no component stylesheet contains a hex literal any
  more. A test parses the stylesheet to prove the JavaScript palette, needed by
  Leaflet and Chart.js, never drifts from it.
- **Dark mode** follows `prefers-color-scheme`. The metric colours are declared
  twice deliberately: no single colour can meet 4.5:1 against both white and a
  dark surface, because the luminance ranges required do not overlap.
- `util.js` was a grab-bag of metric config, formatting, geometry and chart
  transformation; it split into `lib/metrics.js`, `lib/format.js` and
  `lib/chart.js`. Fetching moved out of `App` into a `useSnapshot` hook.
- Component styles moved out of `App.css` and beside their components; `body` is
  styled in one file rather than two; a dead Create React App `code` rule is
  gone; `* { margin: 0 }` became a targeted reset; there is a real
  `:focus-visible` ring; and the single 990px breakpoint became three, so tablet
  widths no longer get the cramped desktop grid.
- **CI now runs on Node 22 and 24.** It previously ran on Node 20, which reached
  end of life on 2026-04-30 and no longer receives security patches. Node 24 is
  what the project is developed on and nothing had been testing it.
- The page description advertised recoveries, which no longer exist, and a
  "120-day" chart that is now 120 weeks.

### Added

- **JSDoc type checking** via `jsconfig.json` and `npm run typecheck`, wired into
  CI. No conversion to TypeScript.
- **Release automation**: `scripts/changelog-section.mjs` extracts a version's
  notes and `.github/workflows/release.yml` publishes them, so release notes are
  read from this file rather than retyped.
- `.gitattributes` normalising line endings, which otherwise depended on each
  contributor's `core.autocrlf` and could break the shell blocks in workflows on
  Linux runners.
- Documentation for the three workflows, and `docs/data-source.md` recording why
  the data is built rather than fetched.

### Notes

- The default branch was renamed from `master` to `main`.
- The weekly data refresh ran unattended for the first time on 2026-08-24 and
  committed the WHO snapshot on its own.

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

[1.3.0]: https://github.com/imnishant2512/Covid19-tracker/releases/tag/v1.3.0
[1.2.0]: https://github.com/imnishant2512/Covid19-tracker/releases/tag/v1.2.0
[1.1.0]: https://github.com/imnishant2512/Covid19-tracker/releases/tag/v1.1.0
[1.0.0]: https://github.com/imnishant2512/Covid19-tracker/releases/tag/v1.0.0
