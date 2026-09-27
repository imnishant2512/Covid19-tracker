import { Suspense, lazy, useMemo, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  FormControl,
  MenuItem,
  Select,
} from "@mui/material";
import InfoBox from "./components/InfoBox";
import Table from "./components/Table";
import DateRange from "./components/DateRange";
import ErrorBoundary from "./components/ErrorBoundary";
import { useHistory, useSnapshot } from "./hooks/useSnapshot";
import { useRangeQuery } from "./hooks/useRangeQuery";
import {
  COUNTRY_ZOOM,
  METRICS,
  METRIC_KEYS,
  WORLDWIDE,
  WORLD_VIEW,
  hasCoordinates,
  sortByMetric,
} from "./lib/metrics";
import { formatNumber, prettyPrintStat } from "./lib/format";
import {
  countriesForRange,
  countrySeries,
  formatRange,
  formatWeek,
  globalForRange,
  resolveRange,
  seriesForRange,
} from "./lib/range";
import "./App.css";

// Leaflet and Chart.js together are ~60% of the bundle and neither is needed
// for first paint, so they load after the stats are on screen.
const Map = lazy(() => import("./components/Map"));
const LineGraph = lazy(() => import("./components/LineGraph"));

function App() {
  const { snapshot, error, isLoading } = useSnapshot();
  const { history, error: historyError } = useHistory();
  const [query, setQuery] = useRangeQuery();
  const [country, setCountry] = useState(WORLDWIDE);
  const [metric, setMetric] = useState(
    /** @type {import("./lib/metrics").MetricKey} */ ("cases")
  );

  // Memoised: `?? []` would otherwise hand a fresh array to every dependent
  // memo on each render.
  const countries = useMemo(() => snapshot?.countries ?? [], [snapshot]);
  const weekDates = useMemo(
    () => snapshot?.weeks.map(([date]) => date) ?? [],
    [snapshot]
  );

  // null means all time, which is what the dashboard shows by default.
  const range = useMemo(() => resolveRange(query, weekDates), [query, weekDates]);

  // Per-country figures for a range come from the history, which loads
  // separately; until it arrives they are unknown, not zero.
  const inView = useMemo(() => {
    if (!range) return countries;
    return history ? countriesForRange(countries, history, range) : null;
  }, [countries, history, range]);
  const historyPending = inView === null && !historyError;
  // A country's figures for a range cannot be worked out without the history.
  // Saying so beats showing zeros, which would read as "none reported".
  const selectedUnavailable = country !== WORLDWIDE && inView === null && Boolean(historyError);

  const global = useMemo(() => {
    if (!snapshot) return {};
    return range ? globalForRange(snapshot.weeks, range) : snapshot.global;
  }, [snapshot, range]);

  const selected = useMemo(() => {
    if (country === WORLDWIDE) return global;
    return inView?.find((entry) => entry.code === country) ?? {};
  }, [country, global, inView]);

  const tableData = useMemo(
    () => sortByMetric(inView ?? [], metric),
    [inView, metric]
  );

  // The chart follows the selected country once its history is available, and
  // the date filter trims it. Without the history it stays worldwide, and says
  // so, rather than waiting on a request that failed.
  const selectedName =
    country === WORLDWIDE
      ? null
      : countries.find((entry) => entry.code === country)?.name ?? null;
  const showCountryChart = Boolean(selectedName) && !historyError;
  const chartWeeks = useMemo(() => {
    const series = showCountryChart
      ? history && countrySeries(history, country)
      : snapshot?.weeks;
    return series ? seriesForRange(series, range) : undefined;
  }, [showCountryChart, history, country, snapshot, range]);

  const period = range ? `Reported ${formatRange(range)}` : null;

  // Memoised so the `center` array keeps a stable identity between renders —
  // otherwise the map would re-fly on every single render.
  const mapView = useMemo(() => {
    if (country === WORLDWIDE) return WORLD_VIEW;

    // A territory with no geometry still has figures to show, but nowhere to
    // fly to.
    const match = countries.find((entry) => entry.code === country);
    if (!match || !hasCoordinates(match)) return WORLD_VIEW;

    return {
      center: /** @type {[number, number]} */ ([match.lat, match.long]),
      zoom: COUNTRY_ZOOM,
    };
  }, [country, countries]);

  return (
    // A main landmark, so assistive technology has a target to jump to. The
    // grid container doubles as it: the page has no nav or sidebar, so
    // everything inside is primary content.
    <main className="app">
      <div className="app__left">
        <header className="app__header">
          <h1 className="app__title">Covid-19 tracker</h1>
          <div className="app__controls">
            <FormControl className="app__dropdown" size="small">
              <Select
                variant="outlined"
                onChange={(event) => setCountry(event.target.value)}
                value={country}
                inputProps={{ "aria-label": "Select a country" }}
              >
                <MenuItem value={WORLDWIDE}>Worldwide</MenuItem>
                {countries.map((entry) => (
                  <MenuItem key={entry.code} value={entry.code}>
                    {entry.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <DateRange weeks={weekDates} range={range} onChange={setQuery} />
          </div>
        </header>

        {error && (
          <Alert severity="error" className="app__error">
            Couldn’t load the figures — {error.message}
          </Alert>
        )}

        {historyError && !error && (
          <Alert severity="warning" className="app__error">
            Figures for a date range and per-country trends are unavailable —{" "}
            {historyError.message}
          </Alert>
        )}

        <div className="app__stats">
          {METRIC_KEYS.map((key) => (
            <InfoBox
              key={key}
              metric={key}
              active={metric === key}
              onSelect={() => setMetric(key)}
              title={METRICS[key].label}
              value={
                selectedUnavailable ? "—" : prettyPrintStat(selected[METRICS[key].field])
              }
              context={
                selectedUnavailable
                  ? "unavailable for this period"
                  : cardContext(METRICS[key].cumulative, range)
              }
              isLoading={isLoading || (country !== WORLDWIDE && historyPending)}
            />
          ))}
        </div>

        <ErrorBoundary fallback="The map couldn’t be displayed.">
          <Suspense fallback={<div className="map map--placeholder" />}>
            <Map
              countries={inView ?? []}
              center={mapView.center}
              zoom={mapView.zoom}
              metric={metric}
              period={period}
            />
          </Suspense>
        </ErrorBoundary>
      </div>

      <Card className="app__right" component="section">
        <CardContent>
          <h2 className="app__panelTitle">
            Countries by {METRICS[metric].label.toLowerCase()}
          </h2>
          <Table
            countries={tableData}
            metric={metric}
            message={tableMessage(range, historyPending, historyError)}
          />

          <h2 className="app__panelTitle app__graphTitle">
            {showCountryChart ? selectedName : "Worldwide"} weekly{" "}
            {metric === "deaths" ? "deaths" : "cases"}
          </h2>
          <ErrorBoundary fallback="The chart couldn’t be displayed.">
            <Suspense
              fallback={<p className="lineGraph__message">Loading chart…</p>}
            >
              <LineGraph
                className="app__graph"
                weeks={chartWeeks}
                metric={metric}
              />
            </Suspense>
          </ErrorBoundary>

          {snapshot && (
            <p className="app__provenance">
              {snapshot.source} data through {snapshot.updated}.{" "}
              {formatNumber(snapshot.global.cases)} cases and{" "}
              {formatNumber(snapshot.global.deaths)} deaths reported worldwide
              in total.{period && ` Showing figures reported ${formatRange(range)}.`}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

/**
 * What a card's figure counts, in the words of the period in view.
 *
 * @param {boolean} cumulative
 * @param {import("./lib/range").Range|null} range
 */
function cardContext(cumulative, range) {
  if (!range) return cumulative ? "total reported" : "in the latest reporting week";
  return cumulative
    ? `reported ${formatRange(range)}`
    : `in the week of ${formatWeek(range.to)}`;
}

/**
 * @param {import("./lib/range").Range|null} range
 * @param {boolean} pending
 * @param {Error|null} error
 */
function tableMessage(range, pending, error) {
  if (!range) return null;
  if (error) return "Figures for this period are unavailable.";
  if (pending) return "Loading figures for this period…";
  return null;
}

export default App;
