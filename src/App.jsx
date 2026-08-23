import { Suspense, lazy, useEffect, useMemo, useState } from "react";
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
import { fetchSnapshot, isAbort } from "./api";
import {
  COUNTRY_ZOOM,
  METRICS,
  METRIC_KEYS,
  WORLDWIDE,
  WORLD_VIEW,
  formatNumber,
  prettyPrintStat,
  sortByMetric,
} from "./util";
import "./App.css";

// Leaflet and Chart.js together are ~60% of the bundle and neither is needed
// for first paint, so they load after the stats are on screen.
const Map = lazy(() => import("./components/Map"));
const LineGraph = lazy(() => import("./components/LineGraph"));

function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [country, setCountry] = useState(WORLDWIDE);
  const [metric, setMetric] = useState("cases");
  const [error, setError] = useState(null);

  // One same-origin request for the whole dataset. Selecting a country is then
  // a local lookup rather than another round trip.
  useEffect(() => {
    const controller = new AbortController();

    fetchSnapshot(controller.signal)
      .then((data) => {
        setSnapshot(data);
        setError(null);
      })
      .catch((err) => {
        if (isAbort(err)) return;
        setError(err);
      });

    return () => controller.abort();
  }, []);

  // Memoised: `?? []` would otherwise hand a fresh array to every dependent
  // memo on each render.
  const countries = useMemo(() => snapshot?.countries ?? [], [snapshot]);
  const isLoading = snapshot === null && !error;

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

    return { center: [match.lat, match.long], zoom: COUNTRY_ZOOM };
  }, [country, countries]);

  return (
    <div className="app">
      <div className="app__left">
        <div className="app__header">
          <h1>Covid-19 tracker</h1>
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
        </div>

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

      <Card className="app__right">
        <CardContent>
          <h3>Countries by {METRICS[metric].label.toLowerCase()}</h3>
          <Table countries={tableData} metric={metric} />

          <h3 className="app__graphTitle">
            Worldwide weekly {metric === "deaths" ? "deaths" : "cases"}
          </h3>
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
