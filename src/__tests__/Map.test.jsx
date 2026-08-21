import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import L from "leaflet";
import Map from "../components/Map";
import { casesTypeColors } from "../util";

const countries = [
  {
    country: "India",
    cases: 45035393,
    recovered: 0,
    deaths: 533570,
    countryInfo: { _id: 356, lat: 20, long: 77, flag: "in.png" },
  },
];

const renderMap = (casesType) =>
  render(
    <Map
      countries={countries}
      casesType={casesType}
      center={[20, 10]}
      zoom={2}
    />
  );

describe("Map circles", () => {
  // Regression: the circles previously used react-leaflet v3+'s `pathOptions`
  // against react-leaflet v2, so Leaflet ignored it and every circle rendered
  // in the default blue instead of the cases-type colour.
  it("paints circles with the colour for the selected cases type", () => {
    const { container } = renderMap("cases");
    const path = container.querySelector(".leaflet-overlay-pane path");

    expect(path).not.toBeNull();
    expect(path.getAttribute("stroke")).toBe(casesTypeColors.cases.hex);
    expect(path.getAttribute("fill")).toBe(casesTypeColors.cases.hex);
  });

  it("uses a different colour for deaths", () => {
    const { container } = renderMap("deaths");
    const path = container.querySelector(".leaflet-overlay-pane path");

    expect(path.getAttribute("stroke")).toBe(casesTypeColors.deaths.hex);
    expect(path.getAttribute("stroke")).not.toBe(casesTypeColors.cases.hex);
  });

  it("renders a tile layer attributing OpenStreetMap", () => {
    const { container } = renderMap("cases");
    expect(container.querySelector(".leaflet-control-attribution").textContent)
      .toMatch(/OpenStreetMap/);
  });
});

describe("Map recentring", () => {
  // react-leaflet documents MapContainer's center/zoom as immutable after mount:
  // "changing them after they have been set a first time will have no effect".
  // Panning therefore has to go through the Leaflet instance, and this proves it
  // does — the App spec mocks Map, so nothing else covers it.
  it("flies the Leaflet instance to a new centre when the props change", () => {
    const flyTo = vi.spyOn(L.Map.prototype, "flyTo");

    const { rerender } = render(
      <Map countries={countries} casesType="cases" center={[20, 10]} zoom={2} />
    );
    flyTo.mockClear();

    rerender(
      <Map countries={countries} casesType="cases" center={[20, 77]} zoom={4} />
    );

    expect(flyTo).toHaveBeenCalledWith([20, 77], 4, expect.anything());
  });

  it("does not re-fly when unrelated props change", () => {
    const flyTo = vi.spyOn(L.Map.prototype, "flyTo");
    const center = [20, 10];

    const { rerender } = render(
      <Map countries={countries} casesType="cases" center={center} zoom={2} />
    );
    flyTo.mockClear();

    rerender(
      <Map countries={countries} casesType="deaths" center={center} zoom={2} />
    );

    expect(flyTo).not.toHaveBeenCalled();
  });
});
