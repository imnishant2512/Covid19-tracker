import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, Popup, useMap } from "react-leaflet";
import { METRICS, circleRadius, hasCoordinates } from "../lib/metrics";
import { formatNumber } from "../lib/format";
import "leaflet/dist/leaflet.css";
import "./Map.css";

/**
 * react-leaflet v3+ treats MapContainer's `center`/`zoom` as initial values only,
 * so changing the selected country needs an imperative move.
 */
/**
 * @param {object} props
 * @param {[number, number]} props.center
 * @param {number} props.zoom
 */
function Recenter({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.75 });
  }, [map, center, zoom]);

  return null;
}

/**
 * Leaflet measures its container once, when the map is created. The container
 * now grows with the page (it fills its column down to the panel beside it),
 * and the panel's height settles only once the table and chart have rendered,
 * so without this Leaflet kept its first size and left grey, untiled strips.
 * Leaflet tracks window resizes itself, but not resizes of its own container.
 */
function FitToContainer() {
  const map = useMap();

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

/**
 * @param {object} props
 * @param {Array<import("../lib/metrics").Country>} props.countries
 * @param {import("../lib/metrics").MetricKey} props.metric
 * @param {string|null} [props.period] Set when the figures cover a date range.
 */
function CountryCircles({ countries, metric, period }) {
  const { hex, field } = METRICS[metric];

  // WHO lists territories the geometry source does not cover. They stay in the
  // totals and the table; they just cannot be placed, and Leaflet throws on a
  // null LatLng.
  // Nor are countries with nothing to show: a zero-radius circle still draws
  // its outline, which over a short period dotted the map with hundreds of
  // points that each read as "cases here".
  const placed = countries.filter(
    (country) => hasCoordinates(country) && (country[field] ?? 0) > 0
  );
  const max = placed.reduce((largest, country) => Math.max(largest, country[field] ?? 0), 0);

  return placed.map((country) => (
    <Circle
      key={country.code}
      center={/** @type {[number, number]} */ ([country.lat, country.long])}
      fillOpacity={0.4}
      pathOptions={{ color: hex, fillColor: hex }}
      radius={circleRadius(country[field], max)}
    >
      <Popup>
        <div className="info-container">
          <div
            className="info-flag"
            style={{ backgroundImage: `url(${country.flag})` }}
          />
          <div className="info-name">{country.name}</div>
          {period && <div className="info-period">{period}</div>}
          <div className="info-confirmed">
            Cases: {formatNumber(country.cases)}
          </div>
          <div className="info-new">
            New cases: {formatNumber(country.newCases)}
          </div>
          <div className="info-deaths">
            Deaths: {formatNumber(country.deaths)}
          </div>
        </div>
      </Popup>
    </Circle>
  ));
}

/**
 * @param {object} props
 * @param {Array<import("../lib/metrics").Country>} props.countries
 * @param {import("../lib/metrics").MetricKey} props.metric
 * @param {[number, number]} props.center
 * @param {number} props.zoom
 * @param {string|null} [props.period] Human description of the date range the
 *   figures cover, shown in each popup; null for all-time totals.
 */
function Map({ countries, metric, center, zoom, period = null }) {
  return (
    <div className="map">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        <Recenter center={center} zoom={zoom} />
        <FitToContainer />
        <CountryCircles countries={countries} metric={metric} period={period} />
      </MapContainer>
    </div>
  );
}

export default Map;
