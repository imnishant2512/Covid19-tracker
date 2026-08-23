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
import ErrorBoundary from "./components/ErrorBoundary";
import { useSnapshot } from "./hooks/useSnapshot";
import {
  COUNTRY_ZOOM,
  METRICS,
  METRIC_KEYS,
  WORLDWIDE,
  WORLD_VIEW,
  sortByMetric,
} from "./lib/metrics";
import { formatNumber, prettyPrintStat } from "./lib/format";
import "./App.css";

// Leaflet and Chart.js together are ~60% of the bundle and neither is needed
// for first paint, so they load after the stats are on screen.
const Map = lazy(() => import("./components/Map"));
const LineGraph = lazy(() => import("./components/LineGraph"));

function App() {
  const { snapshot, error, isLoading } = useSnapshot();
  const [country, setCountry] = useState(WORLDWIDE);
  const [metric, setMetric] = useState("cases");

  // Memoised: `?? []` would otherwise hand a fresh array to every dependent
  // memo on each render.
  const countries = useMemo(() => snapshot?.countries ?? [], [snapshot]);

  const selected = useMemo(() => {
    if (country === WORLDWIDE) return snapshot?.global ?? {};
    return countries.find((entry) => entry.code === country) ?? {};
  }, [country, countries, snapshot]);

  const tableData = useMemo(
    () => sortByMetric(countries, metric),
    [countries, metric]
  );

  // Memoised so the `center` array keeps a stable identity between renders —
  // otherwise the map would re-fly on every single render.
  const mapView = useMemo(() => {
    if (country === WORLDWIDE) return WORLD_VIEW;

    const match = countries.find((entry) => entry.code === country);
    if (!match) return WORLD_VIEW;

    return {
      center: /** @type {[number, number]} */ ([match.lat, match.long]),
      zoom: COUNTRY_ZOOM,
    };
  }, [country, countries]);

  return (
    <div className="app">
      <div className="app__left">
        <header className="app__header">
          <h1 className="app__title">Covid-19 tracker</h1>
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
        </header>

        {error && (
          <Alert severity="error" className="app__error">
            Couldn’t load the figures — {error.message}
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
              value={prettyPrintStat(selected[METRICS[key].field])}
              context={
                METRICS[key].cumulative
                  ? "total reported"
                  : "in the latest reporting week"
              }
              isLoading={isLoading}
            />
          ))}
        </div>

        <ErrorBoundary fallback="The map couldn’t be displayed.">
          <Suspense fallback={<div className="map map--placeholder" />}>
            <Map
              countries={countries}
              center={mapView.center}
              zoom={mapView.zoom}
              metric={metric}
            />
          </Suspense>
        </ErrorBoundary>
      </div>

      <Card className="app__right" component="section">
        <CardContent>
          <h2 className="app__panelTitle">
            Countries by {METRICS[metric].label.toLowerCase()}
          </h2>
          <Table countries={tableData} metric={metric} />

          <h2 className="app__panelTitle app__graphTitle">
            Worldwide weekly {metric === "deaths" ? "deaths" : "cases"}
          </h2>
          <ErrorBoundary fallback="The chart couldn’t be displayed.">
            <Suspense
              fallback={<p className="lineGraph__message">Loading chart…</p>}
            >
              <LineGraph
                className="app__graph"
                weeks={snapshot?.weeks}
                metric={metric}
              />
            </Suspense>
          </ErrorBoundary>

          {snapshot && (
            <p className="app__provenance">
              {snapshot.source} data through {snapshot.updated}.{" "}
              {formatNumber(snapshot.global.cases)} cases and{" "}
              {formatNumber(snapshot.global.deaths)} deaths reported worldwide.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
