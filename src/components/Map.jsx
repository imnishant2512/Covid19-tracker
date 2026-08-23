import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, Popup, useMap } from "react-leaflet";
import { METRICS, circleRadius, formatNumber } from "../util";
import "leaflet/dist/leaflet.css";
import "./Map.css";

/**
 * react-leaflet v3+ treats MapContainer's `center`/`zoom` as initial values only,
 * so changing the selected country needs an imperative move.
 */
function Recenter({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.75 });
  }, [map, center, zoom]);

  return null;
}

function CountryCircles({ countries, metric }) {
  const { hex } = METRICS[metric];

  return countries.map((country) => (
    <Circle
      key={country.code}
      center={[country.lat, country.long]}
      fillOpacity={0.4}
      pathOptions={{ color: hex, fillColor: hex }}
      radius={circleRadius(country, metric)}
    >
      <Popup>
        <div className="info-container">
          <div
            className="info-flag"
            style={{ backgroundImage: `url(${country.flag})` }}
          />
          <div className="info-name">{country.name}</div>
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

function Map({ countries, metric, center, zoom }) {
  return (
    <div className="map">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        <Recenter center={center} zoom={zoom} />
        <CountryCircles countries={countries} metric={metric} />
      </MapContainer>
    </div>
  );
}

export default Map;
