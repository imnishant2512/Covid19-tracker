import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
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

// Leaflet and Chart.js together are ~60% of the bundle and neither is needed
// for first paint, so they load after the stats are on screen.
const Map = lazy(() => import("./components/Map"));
const LineGraph = lazy(() => import("./components/LineGraph"));
import { fetchCountries, fetchCountry, fetchWorldwide, isAbort } from "./api";
import {
  COUNTRY_ZOOM,
  WORLDWIDE,
  WORLD_VIEW,
  prettyPrintStat,
  sortData,
} from "./util";
import "./App.css";

const ERROR_MESSAGES = {
  countries: "Couldn’t load the country list",
  stats: "Couldn’t load the latest figures",
};

function App() {
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState(WORLDWIDE);
  const [countryInfo, setCountryInfo] = useState({});
  const [tableData, setTableData] = useState([]);
  const [mapCountries, setMapCountries] = useState([]);
  const [casesType, setCasesType] = useState("cases");
  const [isLoading, setLoading] = useState(true);

  // Scoped per request, because the country list and the stats load independently:
  // a single shared slot let whichever finished last clear the other's error.
  const [errors, setErrors] = useState({});

  const setScopedError = useCallback((scope, error) => {
    setErrors((previous) => {
      if (!error && !previous[scope]) return previous;

      const next = { ...previous };
      if (error) {
        next[scope] = error;
      } else {
        delete next[scope];
      }
      return next;
    });
  }, []);

  // Country list, table rows and map circles all come from one request.
  useEffect(() => {
    const controller = new AbortController();

    fetchCountries(controller.signal)
      .then((data) => {
        setCountries(
          data.map((entry) => ({
            id: entry.countryInfo._id ?? entry.country,
            name: entry.country,
            value: entry.countryInfo.iso2,
          }))
        );
        setTableData(sortData(data));
        setMapCountries(data.filter((entry) => entry.countryInfo?.lat != null));
        setScopedError("countries", null);
      })
      .catch((err) => {
        if (isAbort(err)) return;
        setScopedError("countries", err);
      });

    return () => controller.abort();
  }, [setScopedError]);

  // Driving the stats fetch off `country` (rather than the change handler) means
  // the initial worldwide load and every later selection share one code path —
  // and a superseded request is aborted instead of racing the current one.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const request =
      country === WORLDWIDE
        ? fetchWorldwide(controller.signal)
        : fetchCountry(country, controller.signal);

    request
      .then((data) => {
        setCountryInfo(data);
        setScopedError("stats", null);
        setLoading(false);
      })
      .catch((err) => {
        if (isAbort(err)) return;
        setScopedError("stats", err);
        setLoading(false);
      });

    return () => controller.abort();
  }, [country, setScopedError]);

  // Memoised so the `center` array keeps a stable identity between renders —
  // otherwise the map would re-fly on every single render.
  const mapView = useMemo(() => {
    const { lat, long } = countryInfo?.countryInfo ?? {};

    if (country === WORLDWIDE || lat == null || long == null) {
      return WORLD_VIEW;
    }

    return { center: [lat, long], zoom: COUNTRY_ZOOM };
  }, [country, countryInfo]);

  const visibleErrors = useMemo(() => Object.entries(errors), [errors]);

  const countryOptions = useMemo(
    () => countries.filter((entry) => Boolean(entry.value)),
    [countries]
  );

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
              {countryOptions.map((entry) => (
                <MenuItem key={entry.id} value={entry.value}>
                  {entry.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        {visibleErrors.map(([scope, scopeError]) => (
          <Alert key={scope} severity="error" className="app__error">
            {ERROR_MESSAGES[scope]} — {scopeError.message}
          </Alert>
        ))}

        <div className="app__stats">
          <InfoBox
            isRed
            active={casesType === "cases"}
            onSelect={() => setCasesType("cases")}
            title="Coronavirus Cases"
            total={prettyPrintStat(countryInfo.cases)}
            cases={prettyPrintStat(countryInfo.todayCases)}
            isLoading={isLoading}
          />
          <InfoBox
            active={casesType === "recovered"}
            onSelect={() => setCasesType("recovered")}
            title="Recovered"
            total={prettyPrintStat(countryInfo.recovered)}
            cases={prettyPrintStat(countryInfo.todayRecovered)}
            isLoading={isLoading}
          />
          <InfoBox
            isGrey
            active={casesType === "deaths"}
            onSelect={() => setCasesType("deaths")}
            title="Deaths"
            total={prettyPrintStat(countryInfo.deaths)}
            cases={prettyPrintStat(countryInfo.todayDeaths)}
            isLoading={isLoading}
          />
        </div>

        <ErrorBoundary fallback="The map couldn’t be displayed.">
          <Suspense fallback={<div className="map map--placeholder" />}>
            <Map
              countries={mapCountries}
              center={mapView.center}
              zoom={mapView.zoom}
              casesType={casesType}
            />
          </Suspense>
        </ErrorBoundary>
      </div>

      <Card className="app__right">
        <CardContent>
          <h3>Live Cases by Country</h3>
          <Table countries={tableData} />
          <h3 className="app__graphTitle">Worldwide new {casesType}</h3>
          <ErrorBoundary fallback="The chart couldn’t be displayed.">
            <Suspense
              fallback={<p className="lineGraph__message">Loading chart…</p>}
            >
              <LineGraph className="app__graph" casesType={casesType} />
            </Suspense>
          </ErrorBoundary>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
